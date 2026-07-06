// ── Mistral AI service — proxy edition ───────────────────────────────────
// All requests go through Express proxy.

const PROXY_URL = (
  "https://full-stack-study-planner.vercel.app" ||
  "https://full-stack-study-planner.onrender.com"
).replace(/\/$/, "");
const MAX_CHUNK_CHARS = 12000;
const REQUEST_TIMEOUT = 30000;

// ── Core request with timeout + retry ────────────────────────────────────
async function proxyRequest(messages, options = {}, retries = 1) {
  const { maxTokens = 1024, temperature = 0.4 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(`${PROXY_URL}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ messages, maxTokens, temperature }),
    });

    clearTimeout(timeoutId);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
    return data.result;
  } catch (err) {
    clearTimeout(timeoutId);

    // Retry once on network errors (not on API errors like rate limit/auth)
    const isNetworkError =
      err.name === "AbortError" ||
      err.message.includes("fetch") ||
      err.message.includes("Failed") ||
      err.message.includes("network");

    if (retries > 0 && isNetworkError) {
      await new Promise((r) => setTimeout(r, 1500)); // wait 1.5s before retry
      return proxyRequest(messages, options, retries - 1);
    }

    if (err.name === "AbortError") throw new Error("TIMEOUT");
    throw err;
  }
}

// ── Health check ──────────────────────────────────────────────────────────
export async function checkProxyHealth() {
  try {
    const res = await fetch(`${PROXY_URL}/api/health`, {
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

  // Summarise chunks in parallel — faster than sequential
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

  // Two-shot prompt: example + instruction reduces parse errors significantly
  const raw = await proxyRequest(
    [
      {
        role: "system",
        content:
          "You are a study assistant that generates quizzes. You ONLY respond with valid JSON. Never add markdown, code fences, or explanation.",
      },
      {
        role: "user",
        content: `Generate exactly ${numQuestions} multiple choice questions from the document below.
 
Return a JSON array exactly like this example (no markdown, no extra text):
[{"question":"What is X?","options":["A","B","C","D"],"correct":0,"explanation":"Because A is correct."}]
 
DOCUMENT:
${chunk}`,
      },
    ],
    { maxTokens: 2048, temperature: 0.2 },
  );

  // Strip any accidental markdown fences
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Find the JSON array even if there's leading/trailing text
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error("PARSE_ERROR");

  try {
    const questions = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(questions) || questions.length === 0)
      throw new Error("Not an array");
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
      content: `You are an expert university tutor helping a student study.
 
When explaining:
• Use simple, clear language
• Define technical terms the first time they appear
• Use examples where helpful
• Point out what is commonly tested in exams
• Be concise — students have limited time
 
Answer based on the document provided.\n\nDOCUMENT:\n${context}`,
    },
    ...conversationHistory.slice(-6),
    { role: "user", content: userMessage },
  ];

  return proxyRequest(messages);
}

// ── Error messages ────────────────────────────────────────────────────────
export function getErrorMessage(error) {
  const msg = error?.message || "";
  if (msg === "TIMEOUT") return "The request timed out. Please try again.";
  if (msg === "RATE_LIMIT") return "Rate limit reached. Please wait a moment.";
  if (msg === "PARSE_ERROR")
    return "The AI returned an unexpected format. Please try again.";
  if (msg === "SERVER_ERROR")
    return "AI service temporarily unavailable. Please try again.";
  if (msg === "INVALID_KEY")
    return "Server configuration error. Please contact support.";
  if (
    msg.includes("fetch") ||
    msg.includes("Failed") ||
    msg.includes("network")
  )
    return "Network error. Please check your connection and try again.";
  return "Something went wrong. Please try again.";
}

// ── Stubs ─────────────────────────────────────────────────────────────────
export const getMistralKey = () => true;
export const saveMistralKey = () => {};
export const clearMistralKey = () => {};
