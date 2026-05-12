const PROXY_URL = (
  import.meta.env.VITE_AI_PROXY_URL || "http://localhost:3001"
).replace(/\/$/, "");
const TOKEN_KEY = "spp_sub_token";

export function getSubToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setSubToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearSubToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Check subscription status — returns { active, token, reason }
export async function checkSubscription() {
  const token = getSubToken();
  if (!token) return { active: false, token: "", reason: "no_token" };

  try {
    const res = await fetch(`${PROXY_URL}/api/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 401) {
      clearSubToken();
      return { active: false, token: "", reason: "invalid_token" };
    }

    if (!res.ok) return { active: !!token, token, reason: "server_error" };

    const data = await res.json();
    return { active: data.active === true, token, reason: data.reason || null };
  } catch {
    // Network error — assume active if token exists (graceful offline)
    return { active: !!token, token, reason: "offline" };
  }
}

// Redirect to Stripe Checkout
export async function startCheckout() {
  const res = await fetch(`${PROXY_URL}/api/subscription/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      successUrl: `${window.location.origin}/?subscribed=true`,
      cancelUrl: `${window.location.origin}/?subscribed=false`,
    }),
  });

  if (!res.ok) throw new Error("Checkout failed");
  const { url } = await res.json();
  window.location.href = url;
}

// Store token after Stripe redirects back
export async function verifySession(sessionId) {
  const res = await fetch(`${PROXY_URL}/api/subscription/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });

  if (!res.ok) throw new Error("Verification failed");
  const data = await res.json();
  if (data.token) setSubToken(data.token);
  return data;
}
