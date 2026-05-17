import { useState, useEffect } from "react";
import { checkSubscription, startCheckout } from "../utils/subscription";

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

const FEATURES = [
  { icon: "◈", label: "One-click document summarisation" },
  { icon: "✦", label: "Auto-generated quizzes with scoring" },
  { icon: "→", label: "Explain any highlighted text" },
  { icon: "◉", label: "Document Q&A chat" },
];

export default function AiAssistant({ fileName }) {
  const [subStatus, setSubStatus] = useState("loading");
  const [subToken, setSubToken] = useState("");
  const [checkoutErr, setCheckoutErr] = useState("");
  const [starting, setStarting] = useState(true);
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

  // ── Loading ────────────────────────────────────────────────────────────
  if (subStatus === "loading") {
    return (
      <div className="ai-coming-soon">
        <div className="ai-cs-inner">
          <div className="fl-spinner" />
        </div>
      </div>
    );
  }

  // ── Active subscriber ──────────────────────────────────────────────────
  if (subStatus === "active") {
    return (
      <div className="ai-coming-soon">
        <div className="ai-cs-inner">
          <div className="ai-cs-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="var(--accent-bg)" />
              <circle
                cx="20"
                cy="20"
                r="9"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <path
                d="M17 20h6M20 17v6"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="ai-cs-badge ai-cs-badge--active">✓ Subscribed</span>
          <h3 className="ai-cs-title">AI Assistant Coming Soon</h3>
          <p className="ai-cs-desc">
            You're all set for <strong>{fileName}</strong>. AI features are
            launching shortly — you'll get immediate access as a subscriber.
          </p>
          <ul className="ai-cs-features">
            {FEATURES.map((f) => (
              <li key={f.label} className="ai-cs-feature">
                <span className="ai-cs-feature-icon">{f.icon}</span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
          <div className="ai-cs-cta">
            {portalErr && <p className="ai-cs-error">{portalErr}</p>}
            <button className="ai-cs-btn-manage" onClick={handleManage}>
              Manage subscription
            </button>
            {/* <p className="ai-cs-footnote">
              Powered by Google Gemini · Cancel anytime in the billing portal
            </p> */}
          </div>
        </div>
      </div>
    );
  }

  // ── Inactive — subscription gate ──────────────────────────────────────
  return (
    <div className="ai-coming-soon">
      <div className="ai-cs-inner">
        <div className="ai-cs-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="var(--accent-bg)" />
            <circle
              cx="20"
              cy="20"
              r="9"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
            <path
              d="M17 20h6M20 17v6"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="ai-cs-badge">Coming Soon</span>
        <h3 className="ai-cs-title">AI Study Assistant</h3>
        <p className="ai-cs-desc">
          Unlock powerful AI features for <strong>{fileName}</strong>:
        </p>
        <ul className="ai-cs-features">
          {FEATURES.map((f) => (
            <li key={f.label} className="ai-cs-feature">
              <span className="ai-cs-feature-icon">{f.icon}</span>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
        <div className="ai-cs-cta">
          <div className="ai-cs-price">
            <span className="ai-cs-price-amount">$4</span>
            <span className="ai-cs-price-period">/ month</span>
          </div>
          {checkoutErr && <p className="ai-cs-error">{checkoutErr}</p>}
          <button
            className="ai-cs-btn-live"
            onClick={handleSubscribe}
            disabled={starting}
          >
            {starting ? "Subscribe — $4 / month" : "Redirecting to checkout…"}
          </button>
          {/* <p className="ai-cs-footnote">
            Powered by Google Gemini · No hidden fees · Cancel anytime
          </p> */}
        </div>
      </div>
    </div>
  );
}
