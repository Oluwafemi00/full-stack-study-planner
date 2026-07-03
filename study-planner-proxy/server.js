require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Validate env ──────────────────────────────────────────────────────────
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
if (!MISTRAL_KEY) {
  console.error("❌  MISTRAL_API_KEY is not set.");
  process.exit(1);
}

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-small-latest";

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
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────
app.use(
  "/api/",
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "RATE_LIMIT",
      message: "Too many requests. Please wait a moment.",
    },
  }),
);

// ── Health check ──────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: MISTRAL_MODEL,
    timestamp: new Date().toISOString(),
  });
});

// ── Main AI endpoint ──────────────────────────────────────────────────────
// Expects: { messages: [...], maxTokens?: number, temperature?: number }
// Returns: { result: string }
app.post("/api/ai", async (req, res) => {
  const { messages, maxTokens = 1024, temperature = 0.4 } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "INVALID_REQUEST",
      message: "messages array is required.",
    });
  }

  try {
    const mistralRes = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages,
        max_tokens: Math.min(Number(maxTokens) || 1024, 2048),
        temperature: Math.min(Math.max(Number(temperature) || 0.4, 0), 1),
      }),
    });

    if (mistralRes.status === 401) {
      console.error("❌  Mistral auth error — check MISTRAL_API_KEY");
      return res.status(502).json({
        error: "INVALID_KEY",
        message: "AI service authentication failed.",
      });
    }
    if (mistralRes.status === 429) {
      console.warn("⚠️  Mistral rate limited");
      return res.status(429).json({
        error: "RATE_LIMIT",
        message: "AI rate limit reached. Please wait a moment.",
      });
    }
    if (!mistralRes.ok) {
      const body = await mistralRes.json().catch(() => ({}));
      console.error("Mistral error:", mistralRes.status, body);
      return res
        .status(502)
        .json({ error: "SERVER_ERROR", message: "AI service unavailable." });
    }

    const data = await mistralRes.json();
    const result = data.choices?.[0]?.message?.content;

    if (!result) {
      return res.status(502).json({
        error: "EMPTY_RESPONSE",
        message: "AI returned an empty response.",
      });
    }

    res.json({ result });
  } catch (err) {
    console.error("Proxy error:", err.message);
    res
      .status(500)
      .json({ error: "SERVER_ERROR", message: "Internal server error." });
  }
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `${req.method} ${req.path} not found.`,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Mistral proxy running on port ${PORT}`);
  console.log(`    Model:   ${MISTRAL_MODEL}`);
  console.log(`    Origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
