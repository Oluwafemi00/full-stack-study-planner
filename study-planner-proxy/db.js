// ── Supabase database layer ───────────────────────────────────────────────
// Handles all subscription persistence.
// Table schema (run this SQL in Supabase SQL editor):
//
// create table subscriptions (
//   token        text primary key,
//   customer_id  text not null,
//   email        text,
//   active_until timestamptz not null,
//   created_at   timestamptz default now()
// );
//
// create index on subscriptions (customer_id);

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key — NOT anon key

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  SUPABASE_URL and SUPABASE_SERVICE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── Save or update a subscription ─────────────────────────────────────────
async function upsertSubscription({ token, customerId, email, activeUntil }) {
  const { error } = await supabase.from("subscriptions").upsert(
    {
      token,
      customer_id: customerId,
      email,
      active_until: activeUntil,
    },
    { onConflict: "token" },
  );

  if (error) throw new Error(`DB upsert error: ${error.message}`);
}

// ── Get subscription by token ─────────────────────────────────────────────
async function getSubscriptionByToken(token) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("token", token)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = row not found
    throw new Error(`DB select error: ${error.message}`);
  }

  return data || null;
}

// ── Get all subscriptions for a customer ──────────────────────────────────
async function getSubscriptionsByCustomer(customerId) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("customer_id", customerId);

  if (error) throw new Error(`DB select error: ${error.message}`);
  return data || [];
}

// ── Delete all subscriptions for a customer (on cancellation) ────────────
async function deleteSubscriptionsByCustomer(customerId) {
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("customer_id", customerId);

  if (error) throw new Error(`DB delete error: ${error.message}`);
}

// ── Delete a single token ─────────────────────────────────────────────────
async function deleteSubscriptionByToken(token) {
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("token", token);

  if (error) throw new Error(`DB delete error: ${error.message}`);
}

// ── Update active_until for all tokens of a customer (on renewal) ─────────
async function renewSubscription(customerId, activeUntil) {
  const { error } = await supabase
    .from("subscriptions")
    .update({ active_until: activeUntil })
    .eq("customer_id", customerId);

  if (error) throw new Error(`DB update error: ${error.message}`);
}

module.exports = {
  upsertSubscription,
  getSubscriptionByToken,
  getSubscriptionsByCustomer,
  deleteSubscriptionsByCustomer,
  deleteSubscriptionByToken,
  renewSubscription,
};
