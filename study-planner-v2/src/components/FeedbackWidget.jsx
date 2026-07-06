import { useState } from "react";

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle, loading, success, error

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("loading");

    try {
      const response = await fetch("https://formspree.io/f/xwvnbydy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message, source: "Study Planner Pro Feedback" }),
      });

      if (response.ok) {
        setStatus("success");
        setTimeout(() => {
          setIsOpen(false);
          setMessage("");
          setStatus("idle");
        }, 2000);
      } else {
        setStatus("error");
      }
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <>
      {/* The Floating Button */}
      <button
        className={`feedback-fab ${isOpen ? "hidden" : ""}`}
        onClick={() => setIsOpen(true)}
        aria-label="Send Feedback"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>

      {/* The Feedback Modal */}
      {isOpen && (
        <div className="feedback-modal-wrap">
          <div className="feedback-modal">
            <div className="feedback-header">
              <span className="feedback-title">Send Feedback</span>
              <button
                className="feedback-close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            {status === "success" ? (
              <div className="feedback-success">
                <span className="success-icon">✓</span>
                <p>Thanks for the feedback!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="feedback-form">
                <textarea
                  className="feedback-textarea"
                  placeholder="What can we improve? Any bugs?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={status === "loading"}
                  autoFocus
                />
                <div className="feedback-footer">
                  <span className="feedback-hint">
                    Sent anonymously to the developer
                  </span>
                  <button
                    type="submit"
                    className="feedback-submit"
                    disabled={!message.trim() || status === "loading"}
                  >
                    {status === "loading" ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
