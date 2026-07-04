// api/health.js — health check
// Vercel auto-routes GET /api/health to this file.

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  res.status(200).json({
    status: "ok",
    model: process.env.MISTRAL_MODEL || "mistral-small-latest",
    timestamp: new Date().toISOString(),
  });
}
