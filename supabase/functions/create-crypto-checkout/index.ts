// =============================================================
// Supabase Edge Function: create-crypto-checkout
// -------------------------------------------------------------
// Receives a customized checkout configuration from the dashboard
// buying panel and creates a NOWPayments crypto invoice.
//
// SECURITY — the price is NEVER trusted from the client. This
// function recomputes the retail total server-side:
//   1. Validate the payload (user + config).
//   2. Load the product's pricing rule from proxy_configuration_rules.
//   3. Fetch the LIVE wholesale cost from Webshare and apply our
//      structural margin multiplier  (see _shared/pricing.ts).
//   4. Insert a `pending` row in public.proxy_orders.
//   5. POST to NOWPayments /v1/invoice with that recomputed total.
//   6. Persist the invoice id back onto the order.
//   7. Return { invoice_url } so the frontend can redirect.
//
// Deploy with verify_jwt = true (only authenticated callers).
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  priceCheckout,
  type ConfigurationRule,
  type RawCheckoutConfig,
} from "../_shared/pricing.ts";

const NOWPAYMENTS_API_URL = Deno.env.get("NOWPAYMENTS_API_URL") ??
  "https://api-sandbox.nowpayments.io/v1";
const NOWPAYMENTS_API_KEY = Deno.env.get("NOWPAYMENTS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";
const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY") ?? "";
const WEBSHARE_BASE_URL = Deno.env.get("WEBSHARE_BASE_URL") ??
  "https://proxy.webshare.io/api/v2";

const PROXY_TYPES = ["static_residential", "rotating_residential", "datacenter"];

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Pull the customization object from either body.config or top-level fields. */
function readConfig(body: Record<string, unknown>): RawCheckoutConfig {
  const c = (body.config ?? body) as Record<string, unknown>;
  return {
    type: c.type != null ? String(c.type).trim().toLowerCase() : undefined,
    qty: (c.qty ?? c.quantity) as number | string | undefined,
    gb: (c.gb ?? c.bandwidth_gb) as number | string | undefined,
    dedicated: c.dedicated === true || c.dedicated === "true",
    exclusivity: c.exclusivity != null
      ? String(c.exclusivity).trim().toLowerCase()
      : undefined,
    country: c.country != null ? String(c.country) : undefined,
    unlimited: c.unlimited === true || c.unlimited === "true",
    standardGb: (c.standardGb ?? c.standard_gb) as number | string | undefined,
    proxyReplacements: (c.proxyReplacements ?? c.proxy_replacements) as
      | number
      | string
      | undefined,
    automaticRefreshFrequency:
      (c.automaticRefreshFrequency ?? c.automatic_refresh_frequency) as
        | number
        | string
        | undefined,
    highPriorityNetwork: c.highPriorityNetwork === true ||
      c.highPriorityNetwork === "true" ||
      c.high_priority_network === true,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    if (!NOWPAYMENTS_API_KEY) {
      throw new Error("NOWPAYMENTS_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Supabase service credentials are not configured");
    }
    if (!WEBSHARE_API_KEY) {
      throw new Error("WEBSHARE_API_KEY is not configured");
    }

    // ---- 1. Parse + validate the incoming frontend request -------------
    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id ?? "").trim();
    const config = readConfig(body);
    const payCurrency = body.pay_currency
      ? String(body.pay_currency).trim().toLowerCase()
      : undefined;

    if (!isUuid(userId)) {
      throw new Error("user_id must be a valid UUID");
    }
    if (!config.type || !PROXY_TYPES.includes(config.type)) {
      throw new Error(`type must be one of: ${PROXY_TYPES.join(", ")}`);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- 2. Confirm the user exists ------------------------------------
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      throw new Error(`profile lookup failed: ${profileErr.message}`);
    }
    if (!profile) {
      throw new Error("user_id does not match any profile");
    }

    // ---- 3. Load the pricing rule + recompute the retail total ---------
    const { data: rule, error: ruleErr } = await supabase
      .from("proxy_configuration_rules")
      .select("*")
      .eq("product_type", config.type)
      .eq("is_active", true)
      .maybeSingle<ConfigurationRule>();
    if (ruleErr) {
      throw new Error(`pricing rule lookup failed: ${ruleErr.message}`);
    }
    if (!rule) {
      throw new Error(`no active pricing rule for ${config.type}`);
    }

    // LIVE Webshare wholesale cost x our structural margin multiplier.
    const pricing = await priceCheckout(rule, config, {
      apiKey: WEBSHARE_API_KEY,
      baseUrl: WEBSHARE_BASE_URL,
    });
    const amountUsd = pricing.retailPrice;
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      throw new Error("computed retail price is invalid");
    }

    // Best-effort observability snapshot of the live wholesale cost.
    await supabase
      .from("proxy_configuration_rules")
      .update({
        last_wholesale_cost: pricing.wholesaleCost,
        last_quote_at: new Date().toISOString(),
      })
      .eq("product_type", config.type);

    // The order metadata captures the exact config + pricing breakdown so
    // an order can always be audited against the margin that produced it.
    const orderMetadata = {
      source: "nowpayments",
      pay_currency: payCurrency ?? null,
      config: {
        type: pricing.productType,
        billing_unit: pricing.billingUnit,
        qty: pricing.quantity,
        gb: pricing.gb,
        dedicated: pricing.dedicated,
        exclusivity: pricing.exclusivity,
        country: pricing.country,
        unlimited: pricing.unlimitedBandwidth,
        standard_gb: pricing.standardGb,
        addons: pricing.addons,
      },
      pricing: {
        wholesale_cost: pricing.wholesaleCost,
        margin_multiplier: pricing.marginMultiplier,
        retail_price: pricing.retailPrice,
        term: pricing.term,
        currency: pricing.currency,
        priced_at: new Date().toISOString(),
      },
    };

    // ---- 4. Create a pending order -------------------------------------
    const { data: order, error: orderErr } = await supabase
      .from("proxy_orders")
      .insert({
        user_id: userId,
        proxy_type: pricing.productType,
        quantity: pricing.quantity,
        total_amount: amountUsd,
        status: "pending",
        payment_method: "crypto",
        metadata: orderMetadata,
      })
      .select("id")
      .single();
    if (orderErr || !order) {
      throw new Error(`order create failed: ${orderErr?.message ?? "unknown"}`);
    }

    // ---- 5. Create the NOWPayments invoice -----------------------------
    const ipnCallbackUrl = Deno.env.get("NOWPAYMENTS_IPN_CALLBACK_URL") ??
      `${SUPABASE_URL}/functions/v1/nowpayments-ipn-webhook`;

    const exclusivity = pricing.exclusivity;
    // Bandwidth-metered products read as a GB amount; proxy-count products
    // read as "x<count>".
    const sizeLabel = pricing.billingUnit === "bandwidth_gb"
      ? `${pricing.gb}GB`
      : `x${pricing.quantity}`;
    const invoicePayload: Record<string, unknown> = {
      price_amount: amountUsd,
      price_currency: "usd",
      order_id: order.id,
      order_description:
        `Oforson Proxies — ${pricing.displayLabel} ${sizeLabel} ` +
        `(${exclusivity}, ${pricing.country})`,
      ipn_callback_url: ipnCallbackUrl,
      success_url: `${APP_URL}/dashboard/billing?status=success`,
      cancel_url: `${APP_URL}/dashboard/billing?status=cancelled`,
    };
    if (payCurrency) invoicePayload.pay_currency = payCurrency;

    const npRes = await fetch(`${NOWPAYMENTS_API_URL}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoicePayload),
    });

    const npData = await npRes.json().catch(() => ({}));

    if (!npRes.ok) {
      // Roll the order into a failed state so it is not left dangling.
      await supabase
        .from("proxy_orders")
        .update({ status: "failed" })
        .eq("id", order.id);
      throw new Error(
        `NOWPayments invoice failed (HTTP ${npRes.status}): ${
          JSON.stringify(npData)
        }`,
      );
    }

    // ---- 6. Persist the invoice id + url back onto the order -----------
    await supabase
      .from("proxy_orders")
      .update({
        invoice_id: npData.id != null ? String(npData.id) : null,
        metadata: { ...orderMetadata, invoice_url: npData.invoice_url ?? null },
      })
      .eq("id", order.id);

    return json({
      ok: true,
      order_id: order.id,
      invoice_id: npData.id ?? null,
      invoice_url: npData.invoice_url ?? null,
      amount_usd: amountUsd,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[create-crypto-checkout]", msg);
    return json({ ok: false, error: msg }, 400);
  }
});
