import { useState, useEffect, useRef } from "react";
import { checkSubscription, startCheckout } from "../utils/subscription";
import {
  summariseBasic,
  answerQuestion,
  getDocumentStats,
  parseProgress,
} from "../utils/transformers";
import {
  summariseDocument,
  explainText,
  generateQuiz,
  chatWithDocument,
  getErrorMessage,
} from "../utils/gemini";

const PROXY_URL = (
  import.meta.env.VITE_AI_PROXY_URL || "http://localhost:3001"
).replace(/\/$/, "");

async function openBillingPortal(token) {
  const res = await fetch(`${PROXY_URL}/api/subscription/portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ returnUrl: window.location.href }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else throw new Error("Could not open portal");
}

// ══════════════════════════════════════════════════════════════════════════
// FREE TIER PANEL
// ══════════════════════════════════════════════════════════════════════════
function FreeTierPanel({
  documentText,
  fileName,
  selectedText,
  onClearSelection,
}) {
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState("");
  const [qaInput, setQaInput] = useState("");
  const [qaResult, setQaResult] = useState(null);
  const [loadingType, setLoadingType] = useState(""); // 'model' | 'summary' | 'qa'
  const [modelProgress, setModelProgress] = useState(null);
  const [error, setError] = useState("");

  const hasDoc = documentText && documentText.length > 50;

  // Compute stats immediately when document loads — no model needed
  useEffect(() => {
    if (hasDoc) setStats(getDocumentStats(documentText));
  }, [documentText]);

  // Auto-fill Q&A input when text is selected
  useEffect(() => {
    if (selectedText && selectedText.length > 5) {
      setQaInput(
        `What does this mean: "${selectedText.slice(0, 80)}${selectedText.length > 80 ? "…" : ""}"`,
      );
    }
  }, [selectedText]);

  async function handleSummarise() {
    if (!hasDoc || loadingType) return;
    setSummary("");
    setError("");
    setLoadingType("model");
    try {
      const result = await summariseBasic(documentText, (progress) => {
        const info = parseProgress(progress);
        if (info) setModelProgress(info);
        if (info?.status === "ready") {
          setModelProgress(null);
          setLoadingType("summary");
        }
      });
      setModelProgress(null);
      setSummary(result);
    } catch (err) {
      setError(
        "Summarisation failed. Try a shorter document or check your browser supports WebAssembly.",
      );
      console.error(err);
    } finally {
      setLoadingType("");
    }
  }

  async function handleAsk(e) {
    e?.preventDefault();
    if (!qaInput.trim() || !hasDoc || loadingType) return;
    setQaResult(null);
    setError("");
    setLoadingType("model");
    try {
      const result = await answerQuestion(qaInput, documentText, (progress) => {
        const info = parseProgress(progress);
        if (info) setModelProgress(info);
        if (info?.status === "ready") {
          setModelProgress(null);
          setLoadingType("qa");
        }
      });
      setModelProgress(null);
      setQaResult(result);
    } catch (err) {
      setError("Q&A failed. Please try again.");
      console.error(err);
    } finally {
      setLoadingType("");
      onClearSelection?.();
    }
  }

  const modelProgressLabel = () => {
    if (!modelProgress)
      return loadingType === "summary" ? "Summarising…" : "Analysing…";
    const { status, file, pct, mb } = modelProgress;
    if (status === "downloading")
      return pct != null
        ? `Downloading model ${pct}% ${mb ? `(${mb})` : ""}`
        : `Downloading model…`;
    if (status === "loading") return "Loading model…";
    return "Processing…";
  };

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <span
            className="ai-indicator free"
            title="Free tier — powered by Transformers.js"
          />
          <span className="ai-title">Basic AI · Free</span>
        </div>
        <span className="ai-free-badge">On-device</span>
      </div>

      {/* Document stats — instant, no model */}
      {stats && (
        <div className="ai-stats-row">
          <div className="ai-stat">
            <span className="ai-stat-num">
              {stats.wordCount.toLocaleString()}
            </span>
            <span className="ai-stat-label">words</span>
          </div>
          <div className="ai-stat">
            <span className="ai-stat-num">{stats.sentences}</span>
            <span className="ai-stat-label">sentences</span>
          </div>
          <div className="ai-stat">
            <span className="ai-stat-num">{stats.readingTime}</span>
            <span className="ai-stat-label">est. read</span>
          </div>
        </div>
      )}

      {/* Keywords */}
      {stats?.keywords?.length > 0 && (
        <div className="ai-keywords">
          <span className="ai-keywords-label">Key topics</span>
          <div className="ai-keyword-chips">
            {stats.keywords.map((kw) => (
              <span key={kw} className="ai-keyword-chip">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="ai-free-section">
        <div className="ai-free-section-header">
          <span className="ai-free-section-title">◈ Basic summary</span>
          <button
            className="ai-action-btn"
            onClick={handleSummarise}
            disabled={!!loadingType || !hasDoc}
          >
            {loadingType === "model" || loadingType === "summary" ? (
              <>
                <span className="ai-spin" /> {modelProgressLabel()}
              </>
            ) : (
              "Summarise"
            )}
          </button>
        </div>

        {summary && (
          <div className="ai-free-result">
            <p>{summary}</p>
            <p className="ai-free-upgrade-hint">
              Want a smarter summary with bullet points and themes?
              <span className="ai-upgrade-link"> Upgrade to Premium ↗</span>
            </p>
          </div>
        )}
      </div>

      {/* Q&A */}
      <div className="ai-free-section">
        <span className="ai-free-section-title">◉ Ask the document</span>
        <p className="ai-free-section-sub">
          Finds answers within the text — extractive, not generative.
        </p>

        <form
          className="ai-input-row"
          onSubmit={handleAsk}
          style={{ marginTop: "0.5rem" }}
        >
          <input
            className="ai-input"
            placeholder="Ask a question about this document…"
            value={qaInput}
            onChange={(e) => setQaInput(e.target.value)}
            disabled={!!loadingType}
          />
          <button
            type="submit"
            className="ai-send-btn"
            disabled={!!loadingType || !qaInput.trim()}
          >
            {loadingType === "qa" ? <span className="ai-spin" /> : "↑"}
          </button>
        </form>

        {qaResult && (
          <div className={`ai-qa-result ${qaResult.found ? "" : "not-found"}`}>
            <p className="ai-qa-answer">{qaResult.answer}</p>
            {qaResult.found && (
              <p className="ai-qa-confidence">
                Confidence: {qaResult.score}%
                {qaResult.score < 60 && " — low confidence, verify in document"}
              </p>
            )}
            {qaResult.found && (
              <p className="ai-free-upgrade-hint">
                For conversational Q&A with follow-up questions,
                <span className="ai-upgrade-link"> upgrade to Premium ↗</span>
              </p>
            )}
          </div>
        )}
      </div>

      {error && <div className="ai-error-msg">{error}</div>}

      {/* First-load warning */}
      <div className="ai-free-notice">
        <span>⚡</span>
        <span>
          First use downloads AI models (~300MB) to your browser. Subsequent
          uses are instant and offline.
        </span>
      </div>

      {/* Upgrade prompt */}
      <div className="ai-upgrade-card">
        <div className="ai-upgrade-card-top">
          <span className="ai-upgrade-card-title">✦ Premium AI</span>
          <span className="ai-upgrade-price">$4/mo</span>
        </div>
        <div className="ai-upgrade-features">
          {[
            "Smart summarisation with themes",
            "Quiz generation (5 MCQs)",
            "Explain highlighted text",
            "Conversational document chat",
          ].map((f) => (
            <span key={f} className="ai-upgrade-feature">
              ✓ {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PREMIUM TIER PANEL (Gemini via proxy)
// ══════════════════════════════════════════════════════════════════════════
function PremiumPanel({
  documentText,
  fileName,
  selectedText,
  onClearSelection,
  subToken,
  onManage,
  portalErr,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [stats, setStats] = useState(null);
  const bottomRef = useRef();

  const hasDoc = documentText && documentText.length > 50;

  useEffect(() => {
    if (hasDoc) setStats(getDocumentStats(documentText));
  }, [documentText]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (selectedText?.trim().length > 10) setActiveTab("chat");
  }, [selectedText]);

  function addMessage(role, content, type = "text") {
    setMessages((prev) => [...prev, { role, content, type, id: Date.now() }]);
  }

  async function handleSummarise() {
    if (!hasDoc || loading) return;
    setLoading(true);
    setLoadingType("summarise");
    addMessage("user", "Summarise this document for me.");
    try {
      const result = await summariseDocument(documentText);
      addMessage("assistant", result);
    } catch (err) {
      addMessage("assistant", getErrorMessage(err), "error");
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  }

  async function handleExplain() {
    if (!selectedText || loading) return;
    setLoading(true);
    setLoadingType("explain");
    addMessage(
      "user",
      `Explain this: "${selectedText.slice(0, 100)}${selectedText.length > 100 ? "…" : ""}"`,
    );
    try {
      const result = await explainText(
        selectedText,
        documentText.slice(0, 500),
      );
      addMessage("assistant", result);
    } catch (err) {
      addMessage("assistant", getErrorMessage(err), "error");
    } finally {
      setLoading(false);
      setLoadingType("");
      onClearSelection?.();
    }
  }

  async function handleQuiz() {
    if (!hasDoc || loading) return;
    setLoading(true);
    setLoadingType("quiz");
    setQuiz(null);
    setQuizState(null);
    try {
      const questions = await generateQuiz(documentText, 5);
      setQuiz(questions);
      setQuizState({
        answers: Array(questions.length).fill(null),
        submitted: false,
      });
      setActiveTab("quiz");
    } catch (err) {
      addMessage("assistant", getErrorMessage(err), "error");
      setActiveTab("chat");
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  }

  async function handleChat(e) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    addMessage("user", msg);
    setLoading(true);
    setLoadingType("chat");
    try {
      const result = await chatWithDocument(msg, documentText, messages);
      addMessage("assistant", result);
    } catch (err) {
      addMessage("assistant", getErrorMessage(err), "error");
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  }

  function selectAnswer(qi, ai) {
    if (quizState?.submitted) return;
    setQuizState((prev) => {
      const a = [...prev.answers];
      a[qi] = ai;
      return { ...prev, answers: a };
    });
  }

  const quizScore = quizState?.submitted
    ? quiz?.filter((q, i) => quizState.answers[i] === q.correct).length
    : null;

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <span className="ai-indicator" title="Premium — Gemini AI" />
          <span className="ai-title">Premium AI</span>
        </div>
        <div className="ai-tabs">
          <button
            className={`ai-tab ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
          <button
            className={`ai-tab ${activeTab === "quiz" ? "active" : ""}`}
            onClick={() => setActiveTab("quiz")}
          >
            Quiz{" "}
            {quiz
              ? `(${quizScore !== null ? `${quizScore}/${quiz.length}` : quiz.length + "Q"})`
              : ""}
          </button>
        </div>
      </div>

      {/* Doc stats */}
      {stats && (
        <div className="ai-stats-row">
          <div className="ai-stat">
            <span className="ai-stat-num">
              {stats.wordCount.toLocaleString()}
            </span>
            <span className="ai-stat-label">words</span>
          </div>
          <div className="ai-stat">
            <span className="ai-stat-num">{stats.readingTime}</span>
            <span className="ai-stat-label">est. read</span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="ai-quick-actions">
        <button
          className={`ai-action-btn ${loadingType === "summarise" ? "loading" : ""}`}
          onClick={handleSummarise}
          disabled={loading || !hasDoc}
        >
          {loadingType === "summarise" ? <span className="ai-spin" /> : "◈"}{" "}
          Summarise
        </button>
        <button
          className={`ai-action-btn ${loadingType === "quiz" ? "loading" : ""}`}
          onClick={handleQuiz}
          disabled={loading || !hasDoc}
        >
          {loadingType === "quiz" ? <span className="ai-spin" /> : "✦"} Quiz me
        </button>
        {selectedText?.length > 10 && (
          <button
            className={`ai-action-btn highlight ${loadingType === "explain" ? "loading" : ""}`}
            onClick={handleExplain}
            disabled={loading}
          >
            {loadingType === "explain" ? <span className="ai-spin" /> : "→"}{" "}
            Explain selection
          </button>
        )}
      </div>

      {/* Chat tab */}
      {activeTab === "chat" && (
        <>
          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="ai-empty">
                <p>
                  Ask anything about <strong>{fileName}</strong>
                </p>
                <div className="ai-suggestions">
                  {[
                    "What are the main topics?",
                    "Give me 3 key takeaways",
                    "What should I focus on for an exam?",
                  ].map((s) => (
                    <button
                      key={s}
                      className="ai-suggestion"
                      onClick={() => setInput(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`ai-msg ${msg.role} ${msg.type === "error" ? "error" : ""}`}
              >
                {msg.role === "assistant" && (
                  <span className="ai-msg-icon">◈</span>
                )}
                <div className="ai-msg-content">
                  {msg.content.split("\n").map((line, i) => (
                    <p
                      key={i}
                      className={line.match(/^[•\-\d]/) ? "ai-bullet" : ""}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {loading &&
              (loadingType === "chat" || loadingType === "summarise") && (
                <div className="ai-msg assistant">
                  <span className="ai-msg-icon">◈</span>
                  <div className="ai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            <div ref={bottomRef} />
          </div>

          <form className="ai-input-row" onSubmit={handleChat}>
            <input
              ref={null}
              className="ai-input"
              placeholder="Ask about this document…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={loading || !input.trim()}
            >
              {loading && loadingType === "chat" ? (
                <span className="ai-spin" />
              ) : (
                "↑"
              )}
            </button>
          </form>
        </>
      )}

      {/* Quiz tab */}
      {activeTab === "quiz" && (
        <div className="ai-quiz">
          {!quiz && !loading && (
            <div className="ai-empty">
              <p>
                Click <strong>Quiz me</strong> to generate questions.
              </p>
            </div>
          )}
          {loading && loadingType === "quiz" && (
            <div className="ai-quiz-loading">
              <span className="ai-spin lg" />
              <p>Generating questions…</p>
            </div>
          )}
          {quiz && quizState && (
            <>
              {quizState.submitted && (
                <div
                  className={`quiz-score-banner ${quizScore === quiz.length ? "perfect" : quizScore >= quiz.length * 0.6 ? "good" : "retry"}`}
                >
                  <span className="quiz-score-num">
                    {quizScore}/{quiz.length}
                  </span>
                  <span className="quiz-score-label">
                    {quizScore === quiz.length
                      ? "Perfect! 🎉"
                      : quizScore >= quiz.length * 0.6
                        ? "Good work!"
                        : "Keep studying!"}
                  </span>
                  <button
                    className="btn-ghost-sm"
                    onClick={() => {
                      setQuiz(null);
                      setQuizState(null);
                      setActiveTab("chat");
                    }}
                  >
                    New quiz
                  </button>
                </div>
              )}
              <div className="quiz-questions">
                {quiz.map((q, qi) => {
                  const submitted = quizState.submitted;
                  const isCorrect = quizState.answers[qi] === q.correct;
                  return (
                    <div
                      key={qi}
                      className={`quiz-q ${submitted ? (isCorrect ? "correct" : "incorrect") : ""}`}
                    >
                      <p className="quiz-q-text">
                        <span className="quiz-q-num">Q{qi + 1}</span>
                        {q.question}
                      </p>
                      <div className="quiz-options">
                        {q.options.map((opt, oi) => {
                          let cls = "quiz-option";
                          if (submitted) {
                            if (oi === q.correct) cls += " correct";
                            else if (oi === quizState.answers[qi])
                              cls += " wrong";
                          } else if (quizState.answers[qi] === oi)
                            cls += " selected";
                          return (
                            <button
                              key={oi}
                              className={cls}
                              onClick={() => selectAnswer(qi, oi)}
                              disabled={submitted}
                            >
                              <span className="quiz-opt-letter">
                                {String.fromCharCode(65 + oi)}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {submitted && (
                        <div className="quiz-explanation">
                          <span className="quiz-exp-label">
                            {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                          </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!quizState.submitted && (
                <button
                  className="btn-primary quiz-submit-btn"
                  onClick={() =>
                    setQuizState((p) => ({ ...p, submitted: true }))
                  }
                  disabled={quizState.answers.some((a) => a === null)}
                >
                  Submit answers{" "}
                  {quizState.answers.some((a) => a === null) &&
                    `(${quizState.answers.filter((a) => a === null).length} left)`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Manage sub */}
      <div className="ai-manage-row">
        {portalErr && (
          <p className="ai-cs-error" style={{ marginBottom: 4 }}>
            {portalErr}
          </p>
        )}
        <button className="ai-cs-btn-manage" onClick={onManage}>
          Manage subscription
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — routes to correct panel
// ══════════════════════════════════════════════════════════════════════════
export default function AiAssistant({
  documentText,
  fileName,
  selectedText,
  onClearSelection,
}) {
  const [subStatus, setSubStatus] = useState("loading");
  const [subToken, setSubToken] = useState("");
  const [checkoutErr, setCheckoutErr] = useState("");
  const [starting, setStarting] = useState(false);
  const [portalErr, setPortalErr] = useState("");

  useEffect(() => {
    checkSubscription().then(({ active, token }) => {
      setSubStatus(active ? "active" : "inactive");
      if (token) setSubToken(token);
    });
  }, []);

  async function handleSubscribe() {
    setStarting(true);
    setCheckoutErr("");
    try {
      await startCheckout();
    } catch {
      setCheckoutErr("Could not start checkout. Please try again.");
      setStarting(false);
    }
  }

  async function handleManage() {
    setPortalErr("");
    try {
      await openBillingPortal(subToken);
    } catch {
      setPortalErr("Could not open billing portal. Please try again.");
    }
  }

  // Loading
  if (subStatus === "loading") {
    return (
      <div className="ai-coming-soon">
        <div className="ai-cs-inner">
          <div className="fl-spinner" />
        </div>
      </div>
    );
  }

  // Active subscriber — full Gemini panel
  if (subStatus === "active") {
    return (
      <PremiumPanel
        documentText={documentText}
        fileName={fileName}
        selectedText={selectedText}
        onClearSelection={onClearSelection}
        subToken={subToken}
        onManage={handleManage}
        portalErr={portalErr}
      />
    );
  }

  // Free user — Transformers.js panel + upgrade prompt
  return (
    <>
      <FreeTierPanel
        documentText={documentText}
        fileName={fileName}
        selectedText={selectedText}
        onClearSelection={onClearSelection}
      />
      {/* Subscribe CTA at bottom of free panel */}
      <div className="ai-subscribe-footer">
        {checkoutErr && <p className="ai-cs-error">{checkoutErr}</p>}
        <button
          className="ai-cs-btn-live"
          onClick={handleSubscribe}
          disabled={starting}
        >
          {starting ? "Redirecting…" : "✦ Upgrade to Premium — $4/month"}
        </button>
        <p className="ai-cs-footnote">
          Powered by Google Gemini · Cancel anytime
        </p>
      </div>
    </>
  );
}
