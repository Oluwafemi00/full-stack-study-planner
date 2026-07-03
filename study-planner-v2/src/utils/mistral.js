// ── Mistral AI service — direct browser calls ───────────────────────────
// Calls Mistral's chat completions API directly using a user-provided key.
// No proxy server needed — the API key is stored in localStorage.

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-small-latest";
const STORAGE_KEY = "spp_mistral_key";
const MAX_CHUNK_CHARS = 12000;

// ── API Key Management ───────────────────────────────────────────────────

export const getMistralKey = () => localStorage.getItem(STORAGE_KEY);

export const saveMistralKey = (key) => localStorage.setItem(STORAGE_KEY, key);

export const clearMistralKey = () => localStorage.removeItem(STORAGE_KEY);

// ── Core request ─────────────────────────────────────────────────────────
async function mistralRequest(messages, options = {}) {
  const { maxTokens = 1024, temperature = 0.4 } = options;
  const key = getMistralKey();

  if (!key) throw new Error("NO_KEY");

  const res = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("INVALID_KEY");
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status >= 500) throw new Error("SERVER_ERROR");
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `HTTP_${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Chunk text ───────────────────────────────────────────────────────────
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

// ── Summarise (full generative) ──────────────────────────────────────────
export async function summariseDocument(text, pageText = null) {
  const source = pageText || text;
  const chunks = chunkText(source);

  const systemMsg = {
    role: "system",
    content:
      "You are a study assistant. Summarise clearly for a student. Use bullet points grouped by key themes. Keep it under 300 words.",
  };

  if (chunks.length === 1) {
    return mistralRequest([
      systemMsg,
      { role: "user", content: `DOCUMENT:\n${chunks[0]}` },
    ]);
  }

  // Summarise each chunk individually
  const partials = await Promise.all(
    chunks.map((chunk, i) =>
      mistralRequest([
        systemMsg,
        {
          role: "user",
          content: `Summarise this section (part ${i + 1} of ${chunks.length}) in 3-5 bullet points:\n\n${chunk}`,
        },
      ]),
    ),
  );

  // Merge partial summaries into one coherent summary
  return mistralRequest([
    systemMsg,
    {
      role: "user",
      content: `Combine these section summaries into one coherent 5-8 bullet point summary for a student:\n\n${partials.join("\n\n")}`,
    },
  ]);
}

// ── Explain selected text ────────────────────────────────────────────────
export async function explainText(selectedText, documentContext = "") {
  const context = documentContext
    ? `This text comes from a document about: ${documentContext.slice(0, 500)}\n\n`
    : "";

  return mistralRequest([
    { role: "system", content: "You are a study assistant." },
    {
      role: "user",
      content: `${context}Explain the following text clearly to a student. Break down complex terms. Keep it concise (2-4 sentences).\n\nTEXT:\n"${selectedText}"`,
    },
  ]);
}

// ── Generate quiz ────────────────────────────────────────────────────────
export async function generateQuiz(text, numQuestions = 5) {
  const chunk = text.slice(0, MAX_CHUNK_CHARS);

  const raw = await mistralRequest(
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

// ── Chat ─────────────────────────────────────────────────────────────────
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
    // Include last 6 messages of conversation history
    ...conversationHistory.slice(-6),
    { role: "user", content: userMessage },
  ];

  return mistralRequest(messages);
}

// ── Error messages ───────────────────────────────────────────────────────
export function getErrorMessage(error) {
  const msg = error?.message || "";
  if (msg === "NO_KEY")
    return "Please add your Mistral API key to use AI features.";
  if (msg === "INVALID_KEY")
    return "Invalid API key. Please check and try again.";
  if (msg === "RATE_LIMIT") return "Rate limit reached. Please wait a moment.";
  if (msg === "PARSE_ERROR")
    return "The AI returned an unexpected format. Please try again.";
  if (msg === "SERVER_ERROR") return "Mistral AI is temporarily unavailable.";
  if (msg.includes("fetch") || msg.includes("Failed"))
    return "Cannot reach Mistral AI. Check your internet connection.";
  return "Something went wrong. Please try again.";
}
