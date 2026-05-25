// =============================================================
// Supabase Edge Function: paystack-webhook
// -------------------------------------------------------------
// Webhook listener for Paystack transaction events.
//
// Security:
//   Every callback is verified with HMAC-SHA512 over the raw
//   request body, keyed with the Paystack SECRET key, and compared
//   against the `x-paystack-signature` header. Unsigned / mismatched
//   callbacks are rejected with 401.
//
// On a verified `charge.success` event:
//   1. Mark the matching proxy_orders row `completed`.
//   2. Generate proxy_sessions credentials from the Webshare pool.
//   3. Write a payment_history ledger row.
//   4. Notify the user.
//
// The Paystack transaction `reference` IS the proxy_orders id.
//
// Deploy with verify_jwt = false — Paystack cannot send a Supabase
// JWT; the HMAC signature is the authentication.
// Register this URL under Paystack Dashboard → Settings → API Keys
// & Webhooks → Webhook URL.
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { paymentReceiptEmail, sendEmail } from "../_shared/email.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:3000")
  .replace(/\/+$/, "");

const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY") ?? "";
const WEBSHARE_BASE_URL = Deno.env.get("WEBSHARE_BASE_URL") ??
  "https://proxy.webshare.io/api/v2";

// Mock Gateway: when USE_MOCK_API=true the provisioning step skips the
// upstream fetch and returns hardcoded proxies, so the UI + database can
// be tested without hitting the live API or consuming real credits.
const USE_MOCK_API = (Deno.env.get("USE_MOCK_API") ?? "false")
  .toLowerCase() === "true";

const jsonHeaders = { "Content-Type": "application/json" };

interface OrderRow {
  id: string;
  user_id: string;
  proxy_type: "static_residential" | "rotating_residential" | "datacenter";
  quantity: number;
  total_amount: number;
  status: string;
  metadata: Record<string, unknown> | null;
}

interface SessionRow {
  user_id: string;
  proxy_type: string;
  country_code: string;
  ip_address: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  is_active: boolean;
}

// ---- Crypto helpers ---------------------------------------------------

/** HMAC-SHA512 hex digest using the Web Crypto API. */
async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

// ---- Proxy provisioning ----------------------------------------------

function proxyLabel(t: string): string {
  if (t === "datacenter") return "datacenter";
  if (t === "static_residential") return "static residential";
  return "rotating residential";
}

/** Order config block from the metadata. */
function orderConfig(order: OrderRow): Record<string, unknown> {
  const meta = order.metadata ?? {};
  return (meta.config ?? {}) as Record<string, unknown>;
}

/** True when the order is a bandwidth-metered (per-GB) plan. */
function isBandwidthOrder(order: OrderRow): boolean {
  return orderConfig(order).billing_unit === "bandwidth_gb";
}

/** "50 GB" for a bandwidth plan, "x100" for a proxy-count order. */
function orderSizeLabel(order: OrderRow): string {
  const cfg = orderConfig(order);
  if (cfg.billing_unit === "bandwidth_gb") {
    const gb = Number(cfg.gb ?? 0);
    return Number.isFinite(gb) && gb > 0 ? `${gb} GB` : "bandwidth plan";
  }
  return `x${Math.max(1, order.quantity ?? 1)}`;
}

/** "Bank transfer" or "Card", read from the Paystack order metadata. */
function paymentMethodLabel(order: OrderRow): string {
  const meta = order.metadata ?? {};
  const ps = (meta.paystack ?? {}) as Record<string, unknown>;
  return ps.payment_channel === "bank_transfer" ? "Bank transfer" : "Card";
}

/**
 * Mock proxy allocation — mirrors the shape of a successful upstream
 * GET /proxy/list/ response. Used when USE_MOCK_API=true. Addresses come
 * from the TEST-NET-2 documentation range (198.51.100.0/24).
 */
function mockProxyResults(qty: number): Array<Record<string, unknown>> {
  return Array.from({ length: qty }, (_, i) => ({
    id: `mock-${i + 1}`,
    username: `ofs-mock-${crypto.randomUUID().slice(0, 8)}`,
    password: crypto.randomUUID().slice(0, 12),
    proxy_address: `198.51.100.${(i % 254) + 1}`,
    port: 8000 + (i % 1000),
    country_code: "US",
    valid: true,
  }));
}

/**
 * Build the proxy_sessions rows for a paid order. Datacenter rides a
 * direct connection; residential rides the backbone network. When
 * USE_MOCK_API=true the upstream fetch is skipped entirely.
 */
async function generateSessions(order: OrderRow): Promise<SessionRow[]> {
  const qty = Math.max(1, order.quantity ?? 1);

  let results: Array<Record<string, unknown>>;

  if (USE_MOCK_API) {
    console.log(`[paystack] USE_MOCK_API=true — provisioning ${qty} mock proxies`);
    results = mockProxyResults(qty);
  } else {
    if (!WEBSHARE_API_KEY) {
      throw new Error("Proxy provider API key is not configured");
    }
    const mode = order.proxy_type === "datacenter" ? "direct" : "backbone";
    const res = await fetch(
      `${WEBSHARE_BASE_URL}/proxy/list/?mode=${mode}&page_size=${qty}`,
      { headers: { Authorization: `Token ${WEBSHARE_API_KEY}` } },
    );
    if (!res.ok) {
      throw new Error(`Proxy provider request failed: HTTP ${res.status}`);
    }
    const data = await res.json().catch(() => ({}));
    results = Array.isArray(data.results) ? data.results : [];
  }

  if (results.length === 0) {
    throw new Error("No proxies available to allocate");
  }
  return results.slice(0, qty).map((p): SessionRow => ({
    user_id: order.user_id,
    proxy_type: order.proxy_type,
    country_code: String(p.country_code ?? "US"),
    ip_address: p.proxy_address ? String(p.proxy_address) : null,
    port: p.port != null ? Number(p.port) : null,
    username: p.username != null ? String(p.username) : null,
    password: p.password != null ? String(p.password) : null,
    is_active: true,
  }));
}

// ---- Main handler -----------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  // ---- 1. Verify the HMAC-SHA512 signature ----------------------------
  if (!PAYSTACK_SECRET_KEY) {
    console.error("[paystack] PAYSTACK_SECRET_KEY is not configured");
    return new Response("server misconfigured", { status: 500 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[paystack] Supabase service credentials are not configured");
    return new Response("server misconfigured", { status: 500 });
  }

  const expectedSig = await hmacSha512Hex(PAYSTACK_SECRET_KEY, rawBody);
  if (
    !signature ||
    !timingSafeEqual(signature.toLowerCase(), expectedSig.toLowerCase())
  ) {
    console.error("[paystack] signature verification failed");
    return new Response("invalid signature", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json body", { status: 400 });
  }

  // ---- 2. Interpret the event -----------------------------------------
  const event = String(payload.event ?? "").toLowerCase();
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const reference = String(data.reference ?? "");
  const chargeStatus = String(data.status ?? "").toLowerCase();

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- 2a. Recurring-billing failure -> park the package past_due -----
  // A failed renewal / disabled subscription does NOT delete anything.
  // Flipping subscriptions.status to 'past_due' fires the DB triggers
  // (migration 014): proxy credentials are suspended, the customer's
  // exact IPs are held for a strict 48-hour grace window, and the
  // grace-period email is dispatched. Mapped via the Paystack customer
  // email -> profile -> the customer's most recent live package.
  const PAST_DUE_EVENTS = new Set([
    "invoice.payment_failed",
    "subscription.disable",
    "subscription.not_renew",
  ]);
  if (PAST_DUE_EVENTS.has(event)) {
    const customer = (data.customer ?? {}) as Record<string, unknown>;
    const email = String(customer.email ?? "").trim().toLowerCase();
    if (!email) {
      return new Response(
        JSON.stringify({ ok: true, event, handled: false, note: "no customer email" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (!profile) {
      return new Response(
        JSON.stringify({ ok: true, event, handled: false, note: "customer not found" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", profile.id)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) {
      return new Response(
        JSON.stringify({ ok: true, event, handled: false, note: "no live package" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    await supabase
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("id", sub.id);

    console.log(`[paystack] event=${event} — package ${sub.id} parked past_due`);
    return new Response(
      JSON.stringify({ ok: true, event, handled: true, status: "past_due" }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // Only `charge.success` provisions proxies. Acknowledge everything else
  // with 200 so Paystack stops retrying.
  if (event !== "charge.success" || chargeStatus !== "success") {
    console.log(`[paystack] event=${event} status=${chargeStatus} — acknowledged`);
    return new Response(
      JSON.stringify({ ok: true, event, handled: false }),
      { status: 200, headers: jsonHeaders },
    );
  }

  if (!reference) {
    console.error("[paystack] charge.success missing reference");
    return new Response(
      JSON.stringify({ ok: true, note: "missing reference" }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // ---- 3. Load the local order (reference == proxy_orders.id) ---------
  const { data: order, error: orderErr } = await supabase
    .from("proxy_orders")
    .select("id, user_id, proxy_type, quantity, total_amount, status, metadata")
    .eq("id", reference)
    .maybeSingle<OrderRow>();

  if (orderErr) {
    console.error("[paystack] order lookup failed:", orderErr.message);
    return new Response("db error", { status: 500 });
  }
  if (!order) {
    console.error(`[paystack] no proxy_orders row for reference=${reference}`);
    return new Response(
      JSON.stringify({ ok: true, note: "order not found" }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // ---- 4. Idempotency guard -------------------------------------------
  // Paystack can resend the charge.success callback; only process once.
  if (order.status === "completed") {
    console.log(`[paystack] order ${order.id} already completed — skipping`);
    return new Response(
      JSON.stringify({ ok: true, event, note: "already processed" }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // ---- 5. Mark the order completed ------------------------------------
  await supabase
    .from("proxy_orders")
    .update({
      status: "completed",
      invoice_id: reference,
      payment_method: "card",
    })
    .eq("id", order.id);

  // ---- 6. Allocate the proxies (generate proxy_sessions) --------------
  let sessions: SessionRow[] = [];
  let provisionError = "";
  try {
    sessions = await generateSessions(order);
  } catch (e) {
    provisionError = e instanceof Error ? e.message : String(e);
    console.error("[paystack] proxy provisioning failed:", provisionError);
  }

  if (sessions.length > 0) {
    const { error: sessErr } = await supabase
      .from("proxy_sessions")
      .insert(sessions);
    if (sessErr) {
      provisionError = sessErr.message;
      console.error("[paystack] proxy_sessions insert failed:", sessErr.message);
    }
  } else {
    // Payment succeeded but provisioning failed — drop a marker row so the
    // order is visibly "awaiting provisioning" rather than silently empty.
    await supabase.from("proxy_sessions").insert({
      user_id: order.user_id,
      proxy_type: order.proxy_type,
      country_code: "US",
      ip_address: null,
      port: null,
      username: null,
      password: null,
      is_active: false,
    });
  }

  // ---- 7. Record the payment in the ledger ----------------------------
  const invoiceUrl =
    (order.metadata && typeof order.metadata.invoice_url === "string")
      ? (order.metadata.invoice_url as string)
      : null;
  const chargedCurrency = String(data.currency ?? "").toUpperCase();
  const chargedMajor = Number(data.amount ?? 0) / 100;
  const usdTotal = Number(order.total_amount ?? 0);

  const paymentDescription =
    `${paymentMethodLabel(order)} payment — ${proxyLabel(order.proxy_type)} ` +
    `${orderSizeLabel(order)}` +
    (chargedCurrency
      ? ` (charged ${chargedMajor.toFixed(2)} ${chargedCurrency})`
      : "");

  const { data: paymentRow } = await supabase
    .from("payment_history")
    .insert({
      user_id: order.user_id,
      amount: usdTotal,
      currency: "usd",
      status: "succeeded",
      description: paymentDescription,
      invoice_url: invoiceUrl,
      invoice_id: reference,
      payment_method: "card",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  // ---- 8. Notify the user ---------------------------------------------
  const allocated = sessions.length;
  const bandwidthOrder = isBandwidthOrder(order);
  await supabase.from("notifications").insert({
    user_id: order.user_id,
    title: "Payment confirmed",
    body: allocated > 0
      ? (bandwidthOrder
        ? `Your payment cleared — your ${orderSizeLabel(order)} ${
          proxyLabel(order.proxy_type)
        } plan is now active on your account.`
        : `Your payment cleared — ${allocated} ${
          proxyLabel(order.proxy_type)
        } prox${allocated > 1 ? "ies are" : "y is"} now active on your account.`)
      : `Your payment cleared. Your ${proxyLabel(order.proxy_type)} ${
        bandwidthOrder ? "plan is" : "proxies are"
      } being provisioned and will appear shortly.`,
    type: "success",
  });

  // ---- 9. Email the customer a branded receipt ------------------------
  // App-sent receipt — independent of Paystack's own merchant emails, so
  // the customer always gets a confirmation. No-ops cleanly when
  // RESEND_API_KEY is not configured (see _shared/email.ts).
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, username")
      .eq("id", order.user_id)
      .maybeSingle<{ email: string | null; username: string | null }>();

    const customer = (data.customer ?? {}) as Record<string, unknown>;
    const customerEmail = String(
      profile?.email ?? customer.email ?? "",
    ).trim();

    if (customerEmail && paymentRow?.id) {
      const { subject, html } = paymentReceiptEmail({
        name: profile?.username || customerEmail.split("@")[0] || "there",
        description: paymentDescription,
        method: paymentMethodLabel(order),
        amountLabel: `$${usdTotal.toFixed(2)} USD`,
        chargedLabel:
          chargedCurrency && chargedCurrency !== "USD"
            ? `${chargedMajor.toFixed(2)} ${chargedCurrency}`
            : null,
        receiptRef: reference,
        dateLabel: new Date().toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short",
        }),
        receiptUrl: `${APP_URL}/dashboard/billing/receipt/${paymentRow.id}`,
      });
      const r = await sendEmail({ to: customerEmail, subject, html });
      console.log(
        `[paystack] receipt email -> ${customerEmail}: ` +
          (r.sent ? "sent" : r.skipped ? "skipped (no RESEND_API_KEY)" : `error: ${r.error}`),
      );
    }
  } catch (e) {
    console.error(
      "[paystack] receipt email failed:",
      e instanceof Error ? e.message : String(e),
    );
  }

  console.log(
    `[paystack] order ${order.id} completed — ${allocated} session(s) allocated` +
      (provisionError ? ` (provision warning: ${provisionError})` : ""),
  );

  return new Response(
    JSON.stringify({
      ok: true,
      event,
      order_id: order.id,
      sessions_allocated: allocated,
      provision_error: provisionError || undefined,
    }),
    { status: 200, headers: jsonHeaders },
  );
});
