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
  const [quiz, setQuiz] = useState(null);
  const [quizCount, setQuizCount] = useState(5);
  const [summary, setSummary] = useState(null);
  const [scope, setScope] = useState("page");

  const messagesRef = useRef(null);

  // Auto-scroll messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Reset quiz and summary when scope changes
  useEffect(() => {
    setQuiz(null);
    setSummary(null);
  }, [scope]);

  const getContextText = useCallback(() => {
    if (scope === "page" && pageTexts?.length > 0 && currentPage) {
      return pageTexts[currentPage - 1] || documentText;
    }
    return documentText;
  }, [scope, pageTexts, currentPage, documentText]);

  // ── Chat ────────────────────────────────────────────────────────────────
  const handleSendChat = useCallback(async () => {
    const input = chatInput.trim();
    if (!input || loading) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setLoading(true);

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
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: getErrorMessage(err) },
      ]);
    } finally {
      setLoading(false);
    }
  }, [chatInput, loading, getContextText, messages]);

  // ── Explain selection ───────────────────────────────────────────────────
  const handleExplainSelection = useCallback(async () => {
    if (!selectedText || loading) return;

    const snippet =
      selectedText.length > 200
        ? selectedText.slice(0, 200) + "..."
        : selectedText;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Explain: "${snippet}"` },
    ]);
    setLoading(true);

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
      setLoading(false);
    }
  }, [selectedText, loading, documentText, onClearSelection]);

  // ── Quiz ────────────────────────────────────────────────────────────────
  const handleGenerateQuiz = useCallback(async () => {
    if (loading) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [loading, scope, pageTexts, currentPage, documentText, quizCount]);

  const handleQuizAnswer = useCallback(
    (qIndex, optIndex) => {
      if (!quiz || quiz.submitted) return;
      setQuiz((prev) => ({
        ...prev,
        answers: { ...prev.answers, [qIndex]: optIndex },
      }));
    },
    [quiz],
  );

  const handleQuizSubmit = useCallback(() => {
    if (!quiz || quiz.submitted) return;
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (quiz.answers[i] === q.correct) score++;
    });
    setQuiz((prev) => ({ ...prev, submitted: true, score }));
  }, [quiz]);

  // ── Summary ─────────────────────────────────────────────────────────────
  const handleSummarize = useCallback(async () => {
    if (loading) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [loading, scope, pageTexts, currentPage, documentText]);

  const handleQuickSummarize = useCallback(() => {
    setActiveTab("summary");
    setTimeout(() => handleSummarize(), 50);
  }, [handleSummarize]);

  const handleQuickQuiz = useCallback(() => {
    setActiveTab("quiz");
    setTimeout(() => handleGenerateQuiz(), 50);
  }, [handleGenerateQuiz]);

  const handleChatKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendChat();
      }
    },
    [handleSendChat],
  );

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
        {/* <button
          className={`ai-scope-btn ${scope === "full" ? "active" : ""}`}
          onClick={() => setScope("full")}
        >
          Full Document
        </button> */}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <span className="ai-indicator" />
          <span className="ai-title">AI ASSISTANT</span>
        </div>
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
                → Explain Selection
              </button>
            )}
          </div>

          <div className="ai-messages" ref={messagesRef}>
            {messages.length === 0 && !loading ? (
              <div className="ai-empty">
                <p>
                  Ask me anything about <strong>{fileName}</strong>. Try:
                </p>
                {[
                  // "What is this document about?",
                  "What is this page about?",
                  "Give me the key takeaways",
                  "Explain the main concepts",
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    className="ai-suggestion"
                    onClick={() => setChatInput(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
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
                {loading && (
                  <div className="ai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
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
              placeholder="Ask about this document..."
              disabled={loading}
            />
            <button
              className="ai-send-btn"
              onClick={handleSendChat}
              disabled={loading || !chatInput.trim()}
            >
              ➤
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

          {loading && !quiz && (
            <div className="ai-centered-loading">
              <div className="ai-spin lg" />
              <p>Generating questions...</p>
            </div>
          )}

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
                        const isSelected = quiz.answers[qi] === oi;
                        const isCorrect = q.correct === oi;
                        let optClass = "quiz-option";
                        if (!quiz.submitted && isSelected)
                          optClass += " selected";
                        if (quiz.submitted) {
                          if (isCorrect) optClass += " correct";
                          else if (isSelected && !isCorrect)
                            optClass += " wrong";
                        }
                        return (
                          <button
                            key={oi}
                            className={optClass}
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

          {loading && !summary && (
            <div className="ai-centered-loading">
              <div className="ai-spin lg" />
              <p>Analyzing document...</p>
            </div>
          )}

          {summary && (
            <>
              <div className="ai-summary-content">
                {formatAIResponse(summary)}
              </div>
              <button className="ai-regenerate-btn" onClick={handleSummarize}>
                ↻ Regenerate
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
