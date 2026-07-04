// api/ai.js — Vercel serverless function
// Proxies requests to Mistral AI, keeping the API key server-side.
// Vercel auto-routes POST /api/ai to this file.

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-small-latest";

// ── CORS helper ───────────────────────────────────────────────────────────
function setCORS(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim());
  const allowed =
    allowedOrigins.includes("*") || allowedOrigins.includes(origin);

  res.setHeader("Access-Control-Allow-Origin", allowed ? origin || "*" : "");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ── Rate limiting (in-memory, per IP) ────────────────────────────────────
// Vercel serverless functions are stateless — this resets on cold start.
// Good enough for abuse prevention; for stricter limits use Upstash Redis.
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const window = 60 * 1000; // 1 minute
  const max = 30;

  const record = rateLimitMap.get(ip) || { count: 0, start: now };

  // Reset window if expired
  if (now - record.start > window) {
    record.count = 0;
    record.start = now;
  }

  record.count++;
  rateLimitMap.set(ip, record);

  return record.count <= max;
}

// ── Main handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCORS(req, res);

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  // Rate limit by IP
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: "RATE_LIMIT",
      message: "Too many requests. Please wait a moment.",
    });
  }

  // Validate env
  const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
  if (!MISTRAL_KEY) {
    console.error("MISTRAL_API_KEY is not set");
    return res
      .status(500)
      .json({ error: "SERVER_ERROR", message: "Server misconfiguration." });
  }

  // Parse body
  const { messages, maxTokens = 1024, temperature = 0.4 } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "INVALID_REQUEST",
      message: "messages array is required.",
    });
  }

  // Forward to Mistral
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
      console.error("Mistral auth error");
      return res
        .status(502)
        .json({
          error: "INVALID_KEY",
          message: "AI service authentication failed.",
        });
    }

    if (mistralRes.status === 429) {
      console.warn("Mistral rate limited");
      return res
        .status(429)
        .json({
          error: "RATE_LIMIT",
          message: "AI rate limit reached. Please wait.",
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
      return res
        .status(502)
        .json({
          error: "EMPTY_RESPONSE",
          message: "AI returned an empty response.",
        });
    }

    return res.status(200).json({ result });
  } catch (err) {
    console.error("Proxy error:", err.message);
    return res
      .status(500)
      .json({ error: "SERVER_ERROR", message: "Internal server error." });
  }
}
