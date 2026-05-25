// =============================================================
// Supabase Edge Function: nowpayments-ipn-webhook
// -------------------------------------------------------------
// IPN (Instant Payment Notification) listener for NOWPayments.
//
// Security:
//   Every callback is verified with HMAC-SHA512 over the
//   sorted-key JSON body, keyed with the NOWPayments IPN secret,
//   and compared against the `x-nowpayments-sig` request header.
//   Unsigned / mismatched callbacks are rejected with 401.
//
// On a verified `finished` / `completed` payment:
//   1. Mark the matching proxy_orders row `completed`.
//   2. Generate proxy_sessions credentials from the Webshare pool
//      (datacenter + static/rotating residential).
//   3. Write a payment_history ledger row.
//   4. Notify the user.
//
// Deploy with verify_jwt = false — NOWPayments cannot send a
// Supabase JWT; the HMAC signature is the authentication.
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { paymentReceiptEmail, sendEmail } from "../_shared/email.ts";

const IPN_SECRET = Deno.env.get("NOWPAYMENTS_IPN_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:3000")
  .replace(/\/+$/, "");

// Webshare provisions every proxy type (datacenter + residential).
const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY") ?? "";
const WEBSHARE_BASE_URL = Deno.env.get("WEBSHARE_BASE_URL") ??
  "https://proxy.webshare.io/api/v2";

// Mock Gateway: when USE_MOCK_API=true the provisioning step skips the
// upstream fetch and returns hardcoded proxies, so the UI + database can
// be tested without hitting the live API or consuming real credits.
const USE_MOCK_API = (Deno.env.get("USE_MOCK_API") ?? "false")
  .toLowerCase() === "true";

// NOWPayments payment_status values that mean "money has settled".
const SUCCESS_STATUSES = new Set(["finished", "completed"]);
// Terminal failure states — the order is closed out, no proxies issued.
const FAILED_STATUSES = new Set(["failed", "expired", "refunded"]);

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
  city: string | null;
  ip_address: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  last_checked_at: string;
  bandwidth_limit_gb: number;
  is_active: boolean;
}

// ---- Crypto helpers ---------------------------------------------------

/**
 * Canonical NOWPayments payload string: keys sorted alphabetically,
 * exactly `JSON.stringify(params, Object.keys(params).sort())`.
 */
function sortedStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

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

/**
 * Per-proxy bandwidth cap (GB) for a paid order. 0 = unlimited. A proxy
 * that crosses this cap stops working until the plan renews.
 */
function orderBandwidthLimitGb(order: OrderRow): number {
  const cfg = orderConfig(order);
  if (cfg.billing_unit === "bandwidth_gb") {
    const gb = Number(cfg.gb ?? 0);
    return Number.isFinite(gb) && gb > 0 ? gb : 0;
  }
  if (cfg.unlimited === true) return 0;
  const std = Number(cfg.standard_gb ?? 0);
  return Number.isFinite(std) && std > 0 ? std : 0;
}

/** City pool used to geolocate mock proxies. */
const MOCK_CITIES = [
  "Piscataway",
  "Ashburn",
  "Dallas",
  "Los Angeles",
  "Chicago",
  "Atlanta",
  "Seattle",
  "New York",
];

/**
 * Mock proxy allocation — mirrors the shape of a successful upstream
 * GET /proxy/list/ response so the rest of the pipeline is identical.
 * Used when USE_MOCK_API=true. Addresses come from the TEST-NET-2
 * documentation range (198.51.100.0/24) so they are clearly test data.
 */
function mockProxyResults(qty: number): Array<Record<string, unknown>> {
  return Array.from({ length: qty }, (_, i) => ({
    id: `mock-${i + 1}`,
    username: `ofs-mock-${crypto.randomUUID().slice(0, 8)}`,
    password: crypto.randomUUID().slice(0, 12),
    proxy_address: `198.51.100.${(i % 254) + 1}`,
    port: 8000 + (i % 1000),
    country_code: "US",
    city_name: MOCK_CITIES[i % MOCK_CITIES.length],
    valid: true,
  }));
}

/**
 * Build the proxy_sessions rows for a paid order. Every proxy type is
 * served from a single upstream pool: datacenter over a direct
 * connection, residential (static + rotating) over the backbone network.
 * When USE_MOCK_API=true the upstream fetch is skipped entirely.
 */
async function generateSessions(order: OrderRow): Promise<SessionRow[]> {
  const qty = Math.max(1, order.quantity ?? 1);

  let results: Array<Record<string, unknown>>;

  if (USE_MOCK_API) {
    console.log(`[ipn] USE_MOCK_API=true — provisioning ${qty} mock proxies`);
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
  const bandwidthLimitGb = orderBandwidthLimitGb(order);
  return results.slice(0, qty).map((p): SessionRow => ({
    user_id: order.user_id,
    proxy_type: order.proxy_type,
    country_code: String(p.country_code ?? "US"),
    city: p.city_name != null ? String(p.city_name) : null,
    ip_address: p.proxy_address ? String(p.proxy_address) : null,
    port: p.port != null ? Number(p.port) : null,
    username: p.username != null ? String(p.username) : null,
    password: p.password != null ? String(p.password) : null,
    last_checked_at: p.last_verification != null
      ? String(p.last_verification)
      : new Date().toISOString(),
    bandwidth_limit_gb: bandwidthLimitGb,
    is_active: true,
  }));
}

// ---- Main handler -----------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-nowpayments-sig") ?? "";

  // ---- 1. Verify the HMAC-SHA512 signature ----------------------------
  if (!IPN_SECRET) {
    console.error("[ipn] NOWPAYMENTS_IPN_SECRET is not configured");
    return new Response("server misconfigured", { status: 500 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[ipn] Supabase service credentials are not configured");
    return new Response("server misconfigured", { status: 500 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json body", { status: 400 });
  }

  const expectedSig = await hmacSha512Hex(IPN_SECRET, sortedStringify(payload));
  if (
    !signature ||
    !timingSafeEqual(signature.toLowerCase(), expectedSig.toLowerCase())
  ) {
    console.error("[ipn] signature verification failed");
    return new Response("invalid signature", { status: 401 });
  }

  // ---- 2. Interpret the payment status --------------------------------
  const status = String(payload.payment_status ?? "").toLowerCase();
  const orderId = String(payload.order_id ?? "");
  const invoiceId = payload.invoice_id != null
    ? String(payload.invoice_id)
    : null;

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Non-final states (waiting / confirming / confirmed / sending …):
  // acknowledge with 200 so NOWPayments stops retrying, but do nothing.
  if (!SUCCESS_STATUSES.has(status) && !FAILED_STATUSES.has(status)) {
    console.log(`[ipn] order ${orderId} status=${status} — acknowledged`);
    return new Response(
      JSON.stringify({ ok: true, status, handled: false }),
      { status: 200, headers: jsonHeaders },
    );
  }

  if (!orderId) {
    console.error("[ipn] callback missing order_id");
    return new Response(
      JSON.stringify({ ok: true, note: "missing order_id" }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // ---- 3. Load the local order ----------------------------------------
  const { data: order, error: orderErr } = await supabase
    .from("proxy_orders")
    .select("id, user_id, proxy_type, quantity, total_amount, status, metadata")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();

  if (orderErr) {
    console.error("[ipn] order lookup failed:", orderErr.message);
    return new Response("db error", { status: 500 });
  }
  if (!order) {
    console.error(`[ipn] no proxy_orders row for order_id=${orderId}`);
    return new Response(
      JSON.stringify({ ok: true, note: "order not found" }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // ---- 4a. Terminal failure -------------------------------------------
  if (FAILED_STATUSES.has(status)) {
    if (order.status !== "completed") {
      const newStatus = status === "refunded" ? "refunded" : "failed";
      await supabase
        .from("proxy_orders")
        .update({ status: newStatus, invoice_id: invoiceId })
        .eq("id", order.id);
      await supabase.from("notifications").insert({
        user_id: order.user_id,
        title: "Crypto payment not completed",
        body:
          `Your ${proxyLabel(order.proxy_type)} proxy order could not be ` +
          `completed (status: ${status}). No charge was applied.`,
        type: "warning",
      });
    }
    return new Response(
      JSON.stringify({ ok: true, status, handled: true }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // ---- 4b. Idempotency guard ------------------------------------------
  // NOWPayments can resend the `finished` callback; only process once.
  if (order.status === "completed") {
    console.log(`[ipn] order ${order.id} already completed — skipping`);
    return new Response(
      JSON.stringify({ ok: true, status, note: "already processed" }),
      { status: 200, headers: jsonHeaders },
    );
  }

  // ---- 5. Mark the order completed ------------------------------------
  await supabase
    .from("proxy_orders")
    .update({
      status: "completed",
      invoice_id: invoiceId,
      payment_method: "crypto",
    })
    .eq("id", order.id);

  // ---- 6. Allocate the proxies (generate proxy_sessions) --------------
  let sessions: SessionRow[] = [];
  let provisionError = "";
  try {
    sessions = await generateSessions(order);
  } catch (e) {
    provisionError = e instanceof Error ? e.message : String(e);
    console.error("[ipn] proxy provisioning failed:", provisionError);
  }

  if (sessions.length > 0) {
    const { error: sessErr } = await supabase
      .from("proxy_sessions")
      .insert(sessions);
    if (sessErr) {
      provisionError = sessErr.message;
      console.error("[ipn] proxy_sessions insert failed:", sessErr.message);
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
  const amount = Number(payload.price_amount ?? order.total_amount ?? 0);
  const currency = String(payload.price_currency ?? "usd").toLowerCase();
  const invoiceUrl =
    (order.metadata && typeof order.metadata.invoice_url === "string")
      ? (order.metadata.invoice_url as string)
      : null;

  const paymentDescription =
    `Crypto payment — ${proxyLabel(order.proxy_type)} ${orderSizeLabel(order)}`;

  const { data: paymentRow } = await supabase
    .from("payment_history")
    .insert({
      user_id: order.user_id,
      amount,
      currency,
      status: "succeeded",
      description: paymentDescription,
      invoice_url: invoiceUrl,
      invoice_id: invoiceId,
      payment_method: "crypto",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  // ---- 8. Notify the user ---------------------------------------------
  const allocated = sessions.length;
  const bandwidthOrder = isBandwidthOrder(order);
  await supabase.from("notifications").insert({
    user_id: order.user_id,
    title: "Crypto payment confirmed",
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
  // NOWPayments (especially the sandbox) does not send the customer a
  // purchase email, so the app sends its own — keeping crypto receipts
  // on par with card. No-ops cleanly without RESEND_API_KEY.
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, username")
      .eq("id", order.user_id)
      .maybeSingle<{ email: string | null; username: string | null }>();

    const customerEmail = String(profile?.email ?? "").trim();

    if (customerEmail && paymentRow?.id) {
      const payCur = String(payload.pay_currency ?? "").toUpperCase();
      const payAmt = Number(payload.actually_paid ?? payload.pay_amount ?? 0);
      const { subject, html } = paymentReceiptEmail({
        name: profile?.username || customerEmail.split("@")[0] || "there",
        description: paymentDescription,
        method: "Cryptocurrency",
        amountLabel: `$${amount.toFixed(2)} ${currency.toUpperCase()}`,
        chargedLabel: payCur
          ? payAmt > 0
            ? `${payAmt} ${payCur}`
            : payCur
          : null,
        receiptRef: invoiceId ?? order.id,
        dateLabel: new Date().toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short",
        }),
        receiptUrl: `${APP_URL}/dashboard/billing/receipt/${paymentRow.id}`,
      });
      const r = await sendEmail({ to: customerEmail, subject, html });
      console.log(
        `[ipn] receipt email -> ${customerEmail}: ` +
          (r.sent ? "sent" : r.skipped ? "skipped (no RESEND_API_KEY)" : `error: ${r.error}`),
      );
    }
  } catch (e) {
    console.error(
      "[ipn] receipt email failed:",
      e instanceof Error ? e.message : String(e),
    );
  }

  console.log(
    `[ipn] order ${order.id} completed — ${allocated} session(s) allocated` +
      (provisionError ? ` (provision warning: ${provisionError})` : ""),
  );

  return new Response(
    JSON.stringify({
      ok: true,
      status,
      order_id: order.id,
      sessions_allocated: allocated,
      provision_error: provisionError || undefined,
    }),
    { status: 200, headers: jsonHeaders },
  );
});
