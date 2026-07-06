import { useState, useEffect, useRef, useCallback } from "react";
import {
  summariseDocument,
  explainText,
  generateQuiz,
  chatWithDocument,
  getErrorMessage,
} from "../utils/mistral";

// ── Markdown renderer ─────────────────────────────────────────────────────
function parseBold(str) {
  const parts = str.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  );
}

function formatAIResponse(text) {
  if (!text) return null;
  return text
    .split("\n")
    .filter(Boolean)
    .map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#### "))
        return (
          <h5 key={i} className="ai-heading">
            {parseBold(trimmed.slice(5))}
          </h5>
        );
      if (trimmed.startsWith("### "))
        return (
          <h4 key={i} className="ai-heading">
            {parseBold(trimmed.slice(4))}
          </h4>
        );
      if (trimmed.startsWith("## "))
        return (
          <h3 key={i} className="ai-heading">
            {parseBold(trimmed.slice(3))}
          </h3>
        );
      if (/^[-•*]\s/.test(trimmed)) {
        return (
          <p key={i} className="ai-bullet">
            • {parseBold(trimmed.replace(/^[-•*]\s*/, ""))}
          </p>
        );
      }
      const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);
      if (numMatch) {
        return (
          <p key={i} className="ai-bullet">
            <span className="ai-list-num">{numMatch[1]}.</span>{" "}
            {parseBold(numMatch[2])}
          </p>
        );
      }
      return <p key={i}>{parseBold(trimmed)}</p>;
    });
}

// ── Loading messages per action ───────────────────────────────────────────
const LOADING_MESSAGES = {
  summarise: [
    "Reading document…",
    "Identifying key themes…",
    "Writing summary…",
  ],
  quiz: ["Reading document…", "Crafting questions…", "Almost ready…"],
  explain: ["Analysing selection…", "Preparing explanation…"],
  chat: ["Thinking…", "Composing answer…"],
};

function useLoadingMessage(loadingType) {
  const [msgIndex, setMsgIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    setMsgIndex(0);
    if (!loadingType) return;
    const messages = LOADING_MESSAGES[loadingType] || ["Thinking…"];
    if (messages.length <= 1) return;

    timerRef.current = setInterval(() => {
      setMsgIndex((prev) => Math.min(prev + 1, messages.length - 1));
    }, 2200);

    return () => clearInterval(timerRef.current);
  }, [loadingType]);

  if (!loadingType) return "";
  const messages = LOADING_MESSAGES[loadingType] || ["Thinking…"];
  return messages[msgIndex] || messages[messages.length - 1];
}

// ── Document stats (instant, no AI needed) ────────────────────────────────
function getDocStats(text) {
  if (!text || text.length < 20) return null;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.ceil(words / 200);
  return {
    words: words.toLocaleString(),
    readTime: minutes < 1 ? "<1 min" : `${minutes} min read`,
  };
}

export default function AiAssistant({
  documentText,
  fileName,
  selectedText,
  onClearSelection,
  currentPage,
  pageTexts,
}) {
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [quizCount, setQuizCount] = useState(5);
  const [summary, setSummary] = useState(null);
  const [scope, setScope] = useState("page");

  // Prevent double-fire on quick actions
  const actionLock = useRef(false);
  const messagesRef = useRef(null);

  const loadingMessage = useLoadingMessage(loadingType);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    if (loading) {
      container.scrollTop = container.scrollHeight;
    } else if (messages.length > 0) {
      const last = container.lastElementChild;
      if (last?.classList.contains("assistant")) {
        last.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, loading]);

  // ── Reset on scope change ────────────────────────────────────────────────
  useEffect(() => {
    setQuiz(null);
    setSummary(null);
  }, [scope]);

  // ── Auto-fill explain when text is selected ──────────────────────────────
  useEffect(() => {
    if (selectedText && selectedText.length > 10 && activeTab === "chat") {
      const snippet =
        selectedText.length > 120
          ? selectedText.slice(0, 120) + "…"
          : selectedText;
      setChatInput(`Explain: "${snippet}"`);
    }
  }, [selectedText]);

  const getContextText = useCallback(() => {
    if (scope === "page" && pageTexts?.length > 0) {
      const text = pageTexts[currentPage - 1];
      return text || "This page contains no readable text or is still loading.";
    }
    return documentText;
  }, [scope, pageTexts, currentPage, documentText]);

  const docStats = getDocStats(getContextText());

  // ── Shared loading guard ─────────────────────────────────────────────────
  function startLoading(type) {
    if (loading || actionLock.current) return false;
    actionLock.current = true;
    setLoading(true);
    setLoadingType(type);
    return true;
  }

  function stopLoading() {
    setLoading(false);
    setLoadingType("");
    setTimeout(() => {
      actionLock.current = false;
    }, 300);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  const handleSendChat = useCallback(async () => {
    const input = chatInput.trim();
    if (!input || !startLoading("chat")) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    try {
      const response = await chatWithDocument(
        input,
        getContextText(),
        messages,
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
      onClearSelection?.();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: getErrorMessage(err) },
      ]);
    } finally {
      stopLoading();
    }
  }, [chatInput, loading, getContextText, messages]);

  // ── Explain selection ────────────────────────────────────────────────────
  const handleExplainSelection = useCallback(async () => {
    if (!selectedText || !startLoading("explain")) return;

    const snippet =
      selectedText.length > 200
        ? selectedText.slice(0, 200) + "..."
        : selectedText;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Explain: "${snippet}"` },
    ]);
    setChatInput("");

    try {
      const response = await explainText(
        selectedText,
        documentText?.slice(0, 500) || "",
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
      onClearSelection?.();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: getErrorMessage(err) },
      ]);
    } finally {
      stopLoading();
    }
  }, [selectedText, loading, documentText, onClearSelection]);

  // ── Quiz ─────────────────────────────────────────────────────────────────
  const handleGenerateQuiz = useCallback(async () => {
    if (!startLoading("quiz")) return;
    setQuiz(null);

    try {
      const text =
        scope === "page"
          ? pageTexts?.[currentPage - 1] || documentText
          : documentText;
      const result = await generateQuiz(text, quizCount);
      setQuiz({
        questions: result,
        answers: {},
        submitted: false,
        score: null,
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: getErrorMessage(err) },
      ]);
      setActiveTab("chat");
    } finally {
      stopLoading();
    }
  }, [loading, scope, pageTexts, currentPage, documentText, quizCount]);

  const handleQuizAnswer = (qIndex, optIndex) => {
    if (!quiz || quiz.submitted) return;
    setQuiz((prev) => ({
      ...prev,
      answers: { ...prev.answers, [qIndex]: optIndex },
    }));
  };

  const handleQuizSubmit = () => {
    if (!quiz || quiz.submitted) return;
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (quiz.answers[i] === q.correct) score++;
    });
    setQuiz((prev) => ({ ...prev, submitted: true, score }));
  };

  // ── Summary ──────────────────────────────────────────────────────────────
  const handleSummarize = useCallback(async () => {
    if (!startLoading("summarise")) return;
    setSummary(null);

    try {
      const text =
        scope === "page"
          ? pageTexts?.[currentPage - 1] || documentText
          : documentText;
      const result = await summariseDocument(text);
      setSummary(result);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: getErrorMessage(err) },
      ]);
      setActiveTab("chat");
    } finally {
      stopLoading();
    }
  }, [loading, scope, pageTexts, currentPage, documentText]);

  const handleQuickSummarize = () => {
    setActiveTab("summary");
    setSummary(null);
    setTimeout(handleSummarize, 50);
  };

  const handleQuickQuiz = () => {
    setActiveTab("quiz");
    setQuiz(null);
    setTimeout(handleGenerateQuiz, 50);
  };

  const handleChatKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  // ── Scope toggle ─────────────────────────────────────────────────────────
  const renderScopeToggle = () => {
    if (!pageTexts || pageTexts.length === 0) return null;
    return (
      <div className="ai-scope-toggle">
        <button
          className={`ai-scope-btn ${scope === "page" ? "active" : ""}`}
          onClick={() => setScope("page")}
        >
          This Page
        </button>
        <button
          className={`ai-scope-btn ${scope === "full" ? "active" : ""}`}
          onClick={() => setScope("full")}
        >
          Full Document
        </button>
      </div>
    );
  };

  // ── Loading overlay ───────────────────────────────────────────────────────
  const renderLoadingState = () => (
    <div className="ai-loading-state">
      <div className="ai-loading-dots">
        <span />
        <span />
        <span />
      </div>
      <p className="ai-loading-msg">{loadingMessage}</p>
    </div>
  );

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <span className="ai-indicator" />
          <span className="ai-title">AI Study Buddy</span>
        </div>
        {docStats && (
          <div className="ai-doc-stats">
            <span>{docStats.words} words</span>
            <span className="ai-stats-dot">·</span>
            <span>{docStats.readTime}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
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
          Quiz
        </button>
        <button
          className={`ai-tab ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Summary
        </button>
      </div>

      {/* ── Chat Tab ── */}
      {activeTab === "chat" && (
        <div className="ai-chat-tab">
          {renderScopeToggle()}

          <div className="ai-quick-actions">
            <button
              className="ai-action-btn"
              onClick={handleQuickSummarize}
              disabled={loading}
            >
              ◈ Summarize
            </button>
            <button
              className="ai-action-btn"
              onClick={handleQuickQuiz}
              disabled={loading}
            >
              ✦ Quiz Me
            </button>
            {selectedText && (
              <button
                className="ai-action-btn highlight"
                onClick={handleExplainSelection}
                disabled={loading}
              >
                → Explain
              </button>
            )}
          </div>

          <div className="ai-messages" ref={messagesRef}>
            {messages.length === 0 && !loading ? (
              <div className="ai-empty">
                <div className="ai-welcome-text">
                  <span className="ai-sparkle">✨</span>
                  <p>
                    I'm ready to help you study{" "}
                    <span className="ai-filename-badge" title={fileName}>
                      {fileName.length > 25
                        ? fileName.substring(0, 25) + "..."
                        : fileName}
                    </span>
                  </p>
                </div>
                <div className="ai-suggestions-list">
                  <span className="suggestions-label">Try asking:</span>
                  {[
                    { text: "Explain this page", icon: "📄" },
                    { text: "Give me the key takeaways", icon: "💡" },
                    { text: "Explain the main concepts", icon: "🧠" },
                  ].map((s, i) => (
                    <button
                      key={i}
                      className="ai-suggestion-btn"
                      onClick={() => setChatInput(s.text)}
                    >
                      <div className="suggestion-left">
                        <span className="suggestion-icon">{s.icon}</span>
                        <span>{s.text}</span>
                      </div>
                      <span className="suggestion-arrow">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`ai-msg ${msg.role}`}>
                    {msg.role === "assistant" && (
                      <span className="ai-msg-icon">◈</span>
                    )}
                    <div className="ai-msg-content">
                      {msg.role === "error" ? (
                        <p className="ai-error-text">{msg.content}</p>
                      ) : (
                        formatAIResponse(msg.content)
                      )}
                    </div>
                  </div>
                ))}
                {loading && renderLoadingState()}
              </>
            )}
          </div>

          <div className="ai-input-row">
            <input
              className="ai-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder={
                selectedText
                  ? "Ask about your selection…"
                  : "Need an explanation?"
              }
              disabled={loading}
            />
            <button
              className="ai-send-btn"
              onClick={handleSendChat}
              disabled={loading || !chatInput.trim()}
            >
              {loading && loadingType === "chat" ? (
                <span className="ai-send-spinner" />
              ) : (
                "➤"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Quiz Tab ── */}
      {activeTab === "quiz" && (
        <div className="ai-quiz-tab">
          {renderScopeToggle()}

          {!quiz && !loading && (
            <div className="ai-quiz-config">
              <span className="ai-quiz-config-label">Number of questions</span>
              <div className="ai-quiz-counts">
                <button
                  className={`ai-quiz-count-btn ${quizCount === 5 ? "active" : ""}`}
                  onClick={() => setQuizCount(5)}
                >
                  5
                </button>
                <button
                  className={`ai-quiz-count-btn ${quizCount === 10 ? "active" : ""}`}
                  onClick={() => setQuizCount(10)}
                >
                  10
                </button>
              </div>
              <button
                className="ai-generate-btn"
                onClick={handleGenerateQuiz}
                disabled={loading}
              >
                ✦ Generate Quiz
              </button>
            </div>
          )}

          {loading && !quiz && renderLoadingState()}

          {quiz && (
            <div className="ai-quiz-content">
              {quiz.submitted && (
                <div
                  className={`quiz-score-banner ${quiz.score === quiz.questions.length ? "perfect" : quiz.score >= quiz.questions.length * 0.6 ? "good" : "retry"}`}
                >
                  {quiz.score} / {quiz.questions.length}
                  {quiz.score === quiz.questions.length && " 🎉 Perfect!"}
                  {quiz.score >= quiz.questions.length * 0.6 &&
                    quiz.score < quiz.questions.length &&
                    " 👍 Good job!"}
                  {quiz.score < quiz.questions.length * 0.6 &&
                    " 📖 Keep studying!"}
                </div>
              )}

              <div className="quiz-questions">
                {quiz.questions.map((q, qi) => (
                  <div key={qi} className="quiz-q">
                    <div className="quiz-q-header">
                      <span className="quiz-q-num">{qi + 1}</span>
                      <span className="quiz-q-text">{q.question}</span>
                    </div>
                    <div className="quiz-options">
                      {q.options.map((opt, oi) => {
                        const letters = ["A", "B", "C", "D"];
                        let cls = "quiz-option";
                        if (!quiz.submitted && quiz.answers[qi] === oi)
                          cls += " selected";
                        if (quiz.submitted) {
                          if (q.correct === oi) cls += " correct";
                          else if (quiz.answers[qi] === oi && q.correct !== oi)
                            cls += " wrong";
                        }
                        return (
                          <button
                            key={oi}
                            className={cls}
                            onClick={() => handleQuizAnswer(qi, oi)}
                            disabled={quiz.submitted}
                          >
                            <span className="quiz-opt-letter">
                              {letters[oi]}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {quiz.submitted && q.explanation && (
                      <div className="quiz-explanation">{q.explanation}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="ai-quiz-actions">
                {!quiz.submitted ? (
                  <button
                    className="quiz-submit-btn btn-primary"
                    onClick={handleQuizSubmit}
                    disabled={
                      Object.keys(quiz.answers).length < quiz.questions.length
                    }
                  >
                    Submit Answers
                  </button>
                ) : (
                  <>
                    <button
                      className="ai-action-btn"
                      onClick={handleGenerateQuiz}
                    >
                      New Quiz
                    </button>
                    <button
                      className="ai-action-btn"
                      onClick={() =>
                        setQuiz((prev) => ({
                          ...prev,
                          answers: {},
                          submitted: false,
                          score: null,
                        }))
                      }
                    >
                      Try Again
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Summary Tab ── */}
      {activeTab === "summary" && (
        <div className="ai-summary-wrap">
          {renderScopeToggle()}

          {!summary && !loading && (
            <button className="ai-generate-btn" onClick={handleSummarize}>
              ◈ Summarize Document
            </button>
          )}

          {loading && !summary && renderLoadingState()}

          {summary && (
            <>
              <div className="ai-summary-content">
                {formatAIResponse(summary)}
              </div>
              <button
                className="ai-regenerate-btn"
                onClick={handleSummarize}
                disabled={loading}
              >
                ↻ Regenerate
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
