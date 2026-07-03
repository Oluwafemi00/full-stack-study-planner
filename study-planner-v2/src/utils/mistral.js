// ── Mistral AI service — proxy edition ───────────────────────────────────
// All requests go through your Express proxy.
// Your Mistral API key lives only on the server — never exposed to the client.
//
// Set VITE_AI_PROXY_URL in your frontend .env:
//   Development:  VITE_AI_PROXY_URL=http://localhost:3001
//   Production:   VITE_AI_PROXY_URL=https://your-proxy.onrender.com

const PROXY_URL = (
  import.meta.env.VITE_AI_PROXY_URL || "http://localhost:3001"
).replace(/\/$/, "");
const MAX_CHUNK_CHARS = 12000;

// ── Core request ──────────────────────────────────────────────────────────
async function proxyRequest(messages, options = {}) {
  const { maxTokens = 1024, temperature = 0.4 } = options;

  const res = await fetch(`${PROXY_URL}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, maxTokens, temperature }),
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

// ── Summarise ─────────────────────────────────────────────────────────────
export async function summariseDocument(text, pageText = null) {
  const source = pageText || text;
  const chunks = chunkText(source);

  const systemMsg = {
    role: "system",
    content:
      "You are a study assistant. Summarise clearly for a student. Use bullet points grouped by key themes. Keep it under 300 words.",
  };

  if (chunks.length === 1) {
    return proxyRequest([
      systemMsg,
      { role: "user", content: `DOCUMENT:\n${chunks[0]}` },
    ]);
  }

  const partials = await Promise.all(
    chunks.map((chunk, i) =>
      proxyRequest([
        systemMsg,
        {
          role: "user",
          content: `Summarise this section (part ${i + 1} of ${chunks.length}) in 3-5 bullet points:\n\n${chunk}`,
        },
      ]),
    ),
  );

  return proxyRequest([
    systemMsg,
    {
      role: "user",
      content: `Combine these section summaries into one coherent 5-8 bullet point summary for a student:\n\n${partials.join("\n\n")}`,
    },
  ]);
}

// ── Explain selected text ─────────────────────────────────────────────────
export async function explainText(selectedText, documentContext = "") {
  const context = documentContext
    ? `This text comes from a document about: ${documentContext.slice(0, 500)}\n\n`
    : "";

  return proxyRequest([
    { role: "system", content: "You are a study assistant." },
    {
      role: "user",
      content: `${context}Explain the following text clearly to a student. Break down complex terms. Keep it concise (2-4 sentences).\n\nTEXT:\n"${selectedText}"`,
    },
  ]);
}

// ── Generate quiz ─────────────────────────────────────────────────────────
export async function generateQuiz(text, numQuestions = 5) {
  const chunk = text.slice(0, MAX_CHUNK_CHARS);

  const raw = await proxyRequest(
    [
      {
        role: "system",
        content: "You are a study assistant that generates quizzes.",
      },
      {
        role: "user",
        content: `Generate exactly ${numQuestions} multiple choice questions from this document. Return ONLY valid JSON array, no markdown:\n[\n  {"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}\n]\n\nDOCUMENT:\n${chunk}`,
      },
    ],
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

  const messages = [
    {
      role: "system",
      content: `You are a helpful study assistant. Answer based on the document provided. Be clear and educational.\n\nDOCUMENT:\n${context}`,
    },
    ...conversationHistory.slice(-6),
    { role: "user", content: userMessage },
  ];

  return proxyRequest(messages);
}

// ── Error messages ────────────────────────────────────────────────────────
export function getErrorMessage(error) {
  const msg = error?.message || "";
  if (msg === "RATE_LIMIT") return "Rate limit reached. Please wait a moment.";
  if (msg === "PARSE_ERROR")
    return "The AI returned an unexpected format. Please try again.";
  if (msg === "SERVER_ERROR")
    return "AI service temporarily unavailable. Please try again.";
  if (msg === "INVALID_KEY")
    return "Server configuration error. Please contact support.";
  if (msg.includes("fetch") || msg.includes("Failed"))
    return `Cannot reach AI server. Make sure the proxy is running at ${PROXY_URL}.`;
  return "Something went wrong. Please try again.";
}

// ── Stubs — key lives on server now ──────────────────────────────────────
export const getMistralKey = () => true;
export const saveMistralKey = () => {};
export const clearMistralKey = () => {};
