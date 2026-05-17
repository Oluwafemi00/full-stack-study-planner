// ── Gemini service — proxy edition (subscriber tier) ─────────────────────
// All requests go through your Express proxy.
// Subscription token from localStorage is sent with every request.

import { getSubToken } from "./subscription";

const PROXY_URL = (
  import.meta.env.VITE_AI_PROXY_URL || "http://localhost:3001"
).replace(/\/$/, "");
const MAX_CHUNK_CHARS = 12000;

// ── Core request ──────────────────────────────────────────────────────────
async function proxyRequest(prompt, options = {}) {
  const { maxTokens = 1024, temperature = 0.4 } = options;
  const token = getSubToken();

  const res = await fetch(`${PROXY_URL}/api/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ prompt, maxTokens, temperature }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
  return data.result;
}

// ── Health check ──────────────────────────────────────────────────────────
export async function checkProxyHealth() {
  try {
    const res = await fetch(`${PROXY_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export function getProxyUrl() {
  return PROXY_URL;
}

// ── Chunk text ────────────────────────────────────────────────────────────
function chunkText(text, maxChars = MAX_CHUNK_CHARS) {
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + maxChars, text.length);
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      if (lastPeriod > i + maxChars * 0.5) end = lastPeriod + 1;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

// ── Summarise (full generative) ───────────────────────────────────────────
export async function summariseDocument(text) {
  const chunks = chunkText(text);
  if (chunks.length === 1) {
    return proxyRequest(
      `You are a study assistant. Summarise the following document clearly and concisely for a student. Use bullet points grouped by key themes. Keep it under 300 words.\n\nDOCUMENT:\n${chunks[0]}`,
    );
  }
  const partials = await Promise.all(
    chunks.map((chunk, i) =>
      proxyRequest(
        `Summarise this section (part ${i + 1} of ${chunks.length}) in 3-5 bullet points:\n\n${chunk}`,
      ),
    ),
  );
  return proxyRequest(
    `Combine these section summaries into one coherent 5-8 bullet point summary for a student:\n\n${partials.join("\n\n")}`,
  );
}

// ── Explain selected text ─────────────────────────────────────────────────
export async function explainText(selectedText, documentContext = "") {
  const context = documentContext
    ? `This text comes from a document about: ${documentContext.slice(0, 500)}\n\n`
    : "";
  return proxyRequest(
    `${context}Explain the following text clearly to a student. Break down complex terms. Keep it concise (2-4 sentences).\n\nTEXT:\n"${selectedText}"`,
  );
}

// ── Generate quiz ─────────────────────────────────────────────────────────
export async function generateQuiz(text, numQuestions = 5) {
  const chunk = text.slice(0, MAX_CHUNK_CHARS);
  const raw = await proxyRequest(
    `Generate exactly ${numQuestions} multiple choice questions from this document. Return ONLY valid JSON array, no markdown:\n[\n  {"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}\n]\n\nDOCUMENT:\n${chunk}`,
    { maxTokens: 2048, temperature: 0.3 },
  );
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const questions = JSON.parse(cleaned);
    if (!Array.isArray(questions)) throw new Error("Not an array");
    return questions.slice(0, numQuestions);
  } catch {
    throw new Error("PARSE_ERROR");
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────
export async function chatWithDocument(
  userMessage,
  documentText,
  conversationHistory = [],
) {
  const context = documentText.slice(0, MAX_CHUNK_CHARS);
  const historyText = conversationHistory
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.content}`)
    .join("\n");
  return proxyRequest(
    `You are a helpful study assistant. Answer based on the document. Be clear and educational.\n\nDOCUMENT:\n${context}\n\n${historyText ? `CONVERSATION:\n${historyText}\n` : ""}Student: ${userMessage}\nAssistant:`,
  );
}

// ── Error messages ────────────────────────────────────────────────────────
export function getErrorMessage(error) {
  const msg = error?.message || "";
  if (msg === "NO_TOKEN" || msg === "INVALID_TOKEN")
    return "Subscription required for this feature.";
  if (msg === "SUBSCRIPTION_EXPIRED") return "Your subscription has expired.";
  if (msg === "RATE_LIMIT") return "Rate limit reached. Please wait a moment.";
  if (msg === "PARSE_ERROR")
    return "The AI returned an unexpected format. Please try again.";
  if (msg === "EMPTY_RESPONSE")
    return "The AI returned an empty response. Please try again.";
  if (msg === "GEMINI_UNAVAILABLE")
    return "AI service temporarily unavailable.";
  if (msg === "SERVER_ERROR") return "Server error. Please try again.";
  if (msg.includes("fetch") || msg.includes("Failed"))
    return `Cannot reach AI server. Make sure the proxy is running.`;
  return "Something went wrong. Please try again.";
}

// ── Stubs — subscription handled server-side ──────────────────────────────
export const getApiKey = () => !!getSubToken();
export const saveApiKey = () => {};
export const clearApiKey = () => {};
