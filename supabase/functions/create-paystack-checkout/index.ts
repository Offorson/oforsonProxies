// =============================================================
// Supabase Edge Function: create-paystack-checkout
// -------------------------------------------------------------
// Receives a customized checkout configuration from the dashboard
// buying panel and creates a Paystack hosted-checkout transaction.
//
// SECURITY — the price is NEVER trusted from the client. This
// function recomputes the retail total server-side:
//   1. Validate the payload (user + config + currency).
//   2. Load the product's pricing rule from proxy_configuration_rules.
//   3. Fetch the LIVE wholesale cost from Webshare and apply our
//      structural margin multiplier  (see _shared/pricing.ts).
//   4. Convert that USD retail total into the customer's currency
//      at a LIVE FX rate  (see _shared/fx.ts).
//   5. Insert a `pending` row in public.proxy_orders.
//   6. POST to Paystack /transaction/initialize with that amount.
//   7. Return { authorization_url } so the frontend can redirect.
//
// The matching paystack-webhook function provisions the proxies
// once Paystack confirms the charge.
//
// Required function secrets:
//   PAYSTACK_SECRET_KEY        — Paystack secret key (sk_live_… / sk_test_…)
//   WEBSHARE_API_KEY           — Webshare API token
// Optional:
//   PAYSTACK_DEFAULT_CURRENCY  — used when the client sends no currency
//   OPENEXCHANGERATES_APP_ID   — hourly FX feed (else free ~daily feed)
//   FX_RATES_URL               — fully custom USD-base FX feed
//
// A Paystack account can only settle the currencies it is enabled
// for; Paystack rejects the rest and that error is surfaced.
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
import { convertUsd, fxOptionsFromEnv } from "../_shared/fx.ts";
import {
  findPaystackCurrency,
  paystackChannelsForCurrency,
} from "../_shared/currencies.ts";

const PAYSTACK_API_URL = Deno.env.get("PAYSTACK_API_URL") ??
  "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const PAYSTACK_DEFAULT_CURRENCY = (Deno.env.get("PAYSTACK_DEFAULT_CURRENCY") ??
  "USD").toUpperCase();

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
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured");
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

    const requestedCurrency = String(
      body.currency ?? PAYSTACK_DEFAULT_CURRENCY,
    ).trim().toUpperCase();
    const currency = findPaystackCurrency(requestedCurrency);

    if (!isUuid(userId)) {
      throw new Error("user_id must be a valid UUID");
    }
    if (!config.type || !PROXY_TYPES.includes(config.type)) {
      throw new Error(`type must be one of: ${PROXY_TYPES.join(", ")}`);
    }
    if (!currency) {
      throw new Error(`unsupported currency: ${requestedCurrency}`);
    }

    // Optional channel restriction. "bank_transfer" == Paystack Pay with
    // Transfer, which is a Nigeria-only (NGN) feature — Paystack settles
    // bank transfers in Naira only, so a non-NGN currency is rejected here.
    const paymentChannel = String(body.payment_channel ?? "")
      .trim()
      .toLowerCase();
    const bankTransferOnly = paymentChannel === "bank_transfer";
    if (bankTransferOnly && currency.code !== "NGN") {
      throw new Error(
        "Bank transfer is only available for NGN — Paystack settles " +
          "transfers in Nigerian Naira only.",
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- 2. Confirm the user exists ------------------------------------
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle<{ id: string; email: string }>();
    if (profileErr) {
      throw new Error(`profile lookup failed: ${profileErr.message}`);
    }
    if (!profile) {
      throw new Error("user_id does not match any profile");
    }
    if (!profile.email) {
      throw new Error("profile has no email — required by Paystack");
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

    // ---- 4. Convert USD -> the customer's currency at a LIVE rate ------
    const fx = await convertUsd(amountUsd, currency.code, fxOptionsFromEnv());
    const amountSubunit = Math.round(fx.amount * currency.subunitFactor);
    if (amountSubunit < 1) {
      throw new Error("computed Paystack amount is below the minimum");
    }

    // Best-effort observability snapshot of the live wholesale cost.
    await supabase
      .from("proxy_configuration_rules")
      .update({
        last_wholesale_cost: pricing.wholesaleCost,
        last_quote_at: new Date().toISOString(),
      })
      .eq("product_type", config.type);

    const orderMetadata: Record<string, unknown> = {
      source: "paystack",
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
      paystack: {
        payment_channel: bankTransferOnly ? "bank_transfer" : "default",
        charge_currency: currency.code,
        charge_amount: fx.amount,
        amount_subunit: amountSubunit,
        fx_rate: fx.rate,
        fx_buffer_pct: fx.bufferPct,
        fx_source: fx.source,
        fx_fetched_at: fx.fetchedAt,
      },
    };

    // ---- 5. Create a pending order -------------------------------------
    // The order id doubles as the Paystack transaction reference.
    const { data: order, error: orderErr } = await supabase
      .from("proxy_orders")
      .insert({
        user_id: userId,
        proxy_type: pricing.productType,
        quantity: pricing.quantity,
        total_amount: amountUsd, // ledger is kept in USD
        status: "pending",
        payment_method: "card",
        metadata: orderMetadata,
      })
      .select("id")
      .single();
    if (orderErr || !order) {
      throw new Error(`order create failed: ${orderErr?.message ?? "unknown"}`);
    }

    // ---- 6. Initialize the Paystack transaction ------------------------
    const exclusivity = pricing.exclusivity;

    // Restrict the hosted checkout to the channels this settlement currency
    // supports. A "bank_transfer" request pins the checkout to the transfer
    // channel only ("Pay with Transfer", NGN); otherwise offer whatever
    // channels the settlement currency supports — and a currency with no
    // explicit list leaves `channels` off so the account defaults apply.
    const channels = bankTransferOnly
      ? ["bank_transfer"]
      : paystackChannelsForCurrency(currency.code);

    const initPayload: Record<string, unknown> = {
      email: profile.email,
      amount: amountSubunit,
      currency: currency.code,
      reference: order.id,
      callback_url: `${APP_URL}/dashboard/billing?status=success`,
      metadata: {
        order_id: order.id,
        user_id: userId,
        product: pricing.displayLabel,
        billing_unit: pricing.billingUnit,
        quantity: pricing.quantity,
        bandwidth_gb: pricing.gb,
        exclusivity,
        country: pricing.country,
        unlimited_bandwidth: pricing.unlimitedBandwidth,
        payment_channel: bankTransferOnly ? "bank_transfer" : "default",
        usd_total: amountUsd,
        fx_rate: fx.rate,
        fx_buffer_pct: fx.bufferPct,
      },
    };
    if (channels) initPayload.channels = channels;

    const initRes = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initPayload),
    });

    const initData = await initRes.json().catch(() => ({}));

    if (!initRes.ok || initData?.status !== true || !initData?.data) {
      // Roll the order into a failed state so it is not left dangling.
      await supabase
        .from("proxy_orders")
        .update({ status: "failed" })
        .eq("id", order.id);

      // A Paystack account only settles the currencies it is enabled for.
      // Surface that as a clear, actionable message instead of a raw dump.
      const psCode = String(initData?.code ?? "");
      const psMsg = String(initData?.message ?? "");
      if (
        psCode === "unsupported_currency" ||
        psMsg.toLowerCase().includes("currency not supported")
      ) {
        throw new Error(
          `Card payments in ${currency.code} are not enabled on this ` +
            `Paystack account. Enable ${currency.code} on the Paystack ` +
            `integration (or contact Paystack support to add it), or ` +
            `charge in a currency the account already supports, such as NGN.`,
        );
      }
      throw new Error(
        `Paystack initialize failed (HTTP ${initRes.status}): ${
          JSON.stringify(initData)
        }`,
      );
    }

    const authorizationUrl = String(initData.data.authorization_url ?? "");
    const accessCode = initData.data.access_code ?? null;

    // ---- 7. Persist the Paystack handles back onto the order -----------
    await supabase
      .from("proxy_orders")
      .update({
        invoice_id: order.id, // == Paystack transaction reference
        metadata: {
          ...orderMetadata,
          paystack: {
            ...(orderMetadata.paystack as Record<string, unknown>),
            reference: order.id,
            access_code: accessCode,
            authorization_url: authorizationUrl,
            // Channels offered on this checkout ("account_default" when the
            // currency has no explicit list — see paystackChannelsForCurrency).
            channels: channels ?? "account_default",
          },
        },
      })
      .eq("id", order.id);

    return json({
      ok: true,
      order_id: order.id,
      reference: order.id,
      authorization_url: authorizationUrl,
      amount_usd: amountUsd,
      charge_currency: currency.code,
      charge_amount: fx.amount,
      fx_rate: fx.rate,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[create-paystack-checkout]", msg);
    return json({ ok: false, error: msg }, 400);
  }
});
