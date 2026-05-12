require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Validate required env vars ────────────────────────────────────────────
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WHK = process.env.STRIPE_WEBHOOK_SECRET;
const PRICE_ID = process.env.STRIPE_PRICE_ID;
const TOKEN_SECRET = process.env.TOKEN_SECRET;

if (!GEMINI_KEY) {
  console.error("❌  GEMINI_API_KEY is not set.");
  process.exit(1);
}
if (!TOKEN_SECRET) {
  console.error("❌  TOKEN_SECRET is not set.");
  process.exit(1);
}

// ── Stripe lazy-load ──────────────────────────────────────────────────────
let stripe = null;
function getStripe() {
  if (!stripe && STRIPE_KEY) stripe = require("stripe")(STRIPE_KEY);
  return stripe;
}

// ── Gemini model fallback chain ───────────────────────────────────────────
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const BASE_URL = "https://generativelanguage.googleapis.com/v1/models";
const modelUrl = (m) => `${BASE_URL}/${m}:generateContent?key=${GEMINI_KEY}`;

// ── CORS ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        ALLOWED_ORIGINS.includes("*") ||
        ALLOWED_ORIGINS.includes(origin)
      )
        return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Raw body for Stripe webhook signature verification — must come before express.json()
app.use("/api/subscription/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT",
    message: "Too many requests. Please wait a moment.",
  },
});

// ── Token generation ──────────────────────────────────────────────────────
function generateToken(customerId) {
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(`${customerId}:${Date.now()}:${Math.random()}`)
    .digest("hex");
}

// ── Subscription middleware ───────────────────────────────────────────────
async function requireSubscription(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();

  if (!token) {
    return res
      .status(401)
      .json({ error: "NO_TOKEN", message: "Subscription required." });
  }

  try {
    const sub = await db.getSubscriptionByToken(token);

    if (!sub) {
      return res
        .status(401)
        .json({ error: "INVALID_TOKEN", message: "Subscription not found." });
    }

    if (new Date(sub.active_until) < new Date()) {
      await db.deleteSubscriptionByToken(token);
      return res
        .status(401)
        .json({
          error: "SUBSCRIPTION_EXPIRED",
          message: "Your subscription has expired.",
        });
    }

    req.subscription = sub;
    next();
  } catch (err) {
    console.error("Subscription check error:", err.message);
    res
      .status(500)
      .json({
        error: "SERVER_ERROR",
        message: "Could not verify subscription.",
      });
  }
}

// ── Gemini with fallback ──────────────────────────────────────────────────
async function callGemini(model, prompt, maxTokens, temperature) {
  return fetch(modelUrl(model), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: Math.min(Math.max(Number(temperature) || 0.4, 0), 1),
        maxOutputTokens: Math.min(Number(maxTokens) || 1024, 2048),
      },
    }),
  });
}

async function callWithFallback(prompt, maxTokens, temperature) {
  let lastError = null;

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    const isPrimary = i === 0;

    try {
      const res = await callGemini(model, prompt, maxTokens, temperature);

      if (res.status === 429) {
        console.warn(
          `⚠️  ${model} rate limited${MODELS[i + 1] ? " — trying " + MODELS[i + 1] : ""}`,
        );
        lastError = { code: "RATE_LIMIT", status: 429 };
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        const body = await res.json().catch(() => ({}));
        console.error(`❌  Auth error on ${model}:`, body);
        throw {
          code: "INVALID_API_KEY",
          status: 502,
          message: "Gemini API key invalid. Check GEMINI_API_KEY.",
        };
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        console.error(`❌  Bad request on ${model}:`, body);
        throw {
          code: "GEMINI_ERROR",
          status: 400,
          message: "Invalid request to AI model.",
        };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`⚠️  ${model} returned ${res.status}:`, body);
        lastError = { code: "GEMINI_UNAVAILABLE", status: 502 };
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = {
          code: "EMPTY_RESPONSE",
          status: 502,
          message: "AI returned empty response.",
        };
        continue;
      }

      if (!isPrimary) console.log(`✅  Served by fallback: ${model}`);
      return { text: text.trim(), modelUsed: model };
    } catch (err) {
      if (err.code) throw err;
      console.error(`⚠️  Network error on ${model}:`, err.message);
      lastError = {
        code: "SERVER_ERROR",
        status: 500,
        message: "Network error reaching AI.",
      };
    }
  }

  throw (
    lastError || {
      code: "SERVER_ERROR",
      status: 500,
      message: "All AI models failed.",
    }
  );
}

// ════════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════════

// ── Health check ──────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    primary: MODELS[0],
    fallback: MODELS[1],
    stripe: !!STRIPE_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ── AI endpoint — subscription required ───────────────────────────────────
app.post("/api/ai", aiLimiter, requireSubscription, async (req, res) => {
  const { prompt, maxTokens = 1024, temperature = 0.4 } = req.body;

  if (!prompt || typeof prompt !== "string")
    return res
      .status(400)
      .json({ error: "INVALID_REQUEST", message: "prompt is required." });

  if (prompt.length > 50000)
    return res
      .status(400)
      .json({
        error: "PROMPT_TOO_LONG",
        message: "Prompt exceeds 50,000 characters.",
      });

  try {
    const { text, modelUsed } = await callWithFallback(
      prompt,
      maxTokens,
      temperature,
    );
    res.json({ result: text, model: modelUsed });
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.code || "SERVER_ERROR",
      message: err.message || "Internal server error.",
    });
  }
});

// ── Subscription status ───────────────────────────────────────────────────
app.get("/api/subscription/status", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.json({ active: false, reason: "no_token" });

  try {
    const sub = await db.getSubscriptionByToken(token);
    if (!sub) return res.json({ active: false, reason: "not_found" });

    const expired = new Date(sub.active_until) < new Date();
    if (expired) {
      await db.deleteSubscriptionByToken(token);
      return res.json({ active: false, reason: "expired" });
    }

    res.json({ active: true, email: sub.email, activeUntil: sub.active_until });
  } catch (err) {
    console.error("Status error:", err.message);
    // Fail open — if DB is down, assume active so users aren't locked out
    res.json({ active: !!token, reason: "db_error" });
  }
});

// ── Create Stripe Checkout session ────────────────────────────────────────
app.post("/api/subscription/checkout", async (req, res) => {
  const s = getStripe();
  if (!s || !PRICE_ID) {
    return res.status(503).json({
      error: "STRIPE_NOT_CONFIGURED",
      message: "Payments are not configured yet. Check back soon.",
    });
  }

  const { successUrl, cancelUrl } = req.body;

  try {
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      // Append session_id so the frontend can verify after redirect
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      // Enable tax collection (optional but good practice)
      automatic_tax: { enabled: true },
      // Let Stripe collect the customer's email
      billing_address_collection: "auto",
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res
      .status(500)
      .json({ error: "CHECKOUT_FAILED", message: "Could not start checkout." });
  }
});

// ── Verify Stripe Checkout session after redirect ──────────────────────────
app.post("/api/subscription/verify", async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: "STRIPE_NOT_CONFIGURED" });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "MISSING_SESSION_ID" });

  try {
    const session = await s.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "PAYMENT_NOT_COMPLETE" });
    }

    const token = generateToken(session.customer.id);
    const activeUntil = new Date(
      session.subscription.current_period_end * 1000,
    ).toISOString();

    await db.upsertSubscription({
      token,
      customerId: session.customer.id,
      email: session.customer_details?.email || session.customer.email,
      activeUntil,
    });

    console.log(`✅  New subscriber: ${session.customer_details?.email}`);
    res.json({ token, activeUntil });
  } catch (err) {
    console.error("Verify error:", err);
    res
      .status(500)
      .json({ error: "VERIFY_FAILED", message: "Could not verify payment." });
  }
});

// ── Stripe Customer Portal — lets users manage/cancel subscription ─────────
app.post("/api/subscription/portal", async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: "STRIPE_NOT_CONFIGURED" });

  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "NO_TOKEN" });

  try {
    const sub = await db.getSubscriptionByToken(token);
    if (!sub) return res.status(401).json({ error: "INVALID_TOKEN" });

    const { returnUrl } = req.body;

    const portalSession = await s.billingPortal.sessions.create({
      customer: sub.customer_id,
      return_url:
        returnUrl || process.env.FRONTEND_URL || "http://localhost:5173",
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error("Portal error:", err);
    res
      .status(500)
      .json({
        error: "PORTAL_FAILED",
        message: "Could not open billing portal.",
      });
  }
});

// ── Stripe webhook ────────────────────────────────────────────────────────
// Keeps subscriptions in sync for renewals and cancellations
app.post("/api/subscription/webhook", async (req, res) => {
  const s = getStripe();
  if (!s || !STRIPE_WHK) return res.status(200).send("Webhook not configured");

  let event;
  try {
    event = s.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      STRIPE_WHK,
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "invoice.paid": {
        // Monthly renewal — extend active_until for this customer
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const periodEnd = invoice.lines.data[0]?.period?.end;
        if (periodEnd) {
          const activeUntil = new Date(periodEnd * 1000).toISOString();
          await db.renewSubscription(customerId, activeUntil);
          console.log(
            `🔄  Renewed subscription for customer ${customerId} until ${activeUntil}`,
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        // Cancellation — remove all tokens for this customer
        const customerId = event.data.object.customer;
        await db.deleteSubscriptionsByCustomer(customerId);
        console.log(`❌  Cancelled subscription for customer ${customerId}`);
        break;
      }

      case "customer.subscription.updated": {
        // Plan change or pause — update active_until
        const sub = event.data.object;
        const customerId = sub.customer;
        const activeUntil = new Date(
          sub.current_period_end * 1000,
        ).toISOString();
        await db.renewSubscription(customerId, activeUntil);
        console.log(`📝  Updated subscription for customer ${customerId}`);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err.message);
    // Return 200 anyway so Stripe doesn't retry — log and investigate separately
  }

  res.json({ received: true });
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res
    .status(404)
    .json({
      error: "NOT_FOUND",
      message: `${req.method} ${req.path} not found.`,
    });
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Study Planner proxy running on port ${PORT}`);
  console.log(`    Primary:  ${MODELS[0]}`);
  console.log(`    Fallback: ${MODELS[1]}`);
  console.log(`    Stripe:   ${STRIPE_KEY ? "configured" : "not configured"}`);
  console.log(`    Origins:  ${ALLOWED_ORIGINS.join(", ")}`);
});
