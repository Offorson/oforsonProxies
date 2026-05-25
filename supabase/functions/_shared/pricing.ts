// =============================================================
// Shared pricing engine  (Supabase Edge Functions / Deno)
// -------------------------------------------------------------
// Single source of truth for converting a customer's checkout
// configuration into a retail price.
//
//   1. Map the config -> Webshare /api/v2/subscription/pricing/ query.
//   2. Fetch the LIVE wholesale cost from Webshare.
//   3. retail = wholesale * margin_multiplier  (from proxy_configuration_rules).
//
// Used by:  create-crypto-checkout, create-paystack-checkout.
//
// NOTE: a parallel (Node) copy of this logic lives at
//   src/lib/pricing/calculator.ts
// Keep the two in sync when changing the query mapping or math.
// =============================================================

/** The three retail products. Matches the public.proxy_type enum. */
export type ProductType =
  | "datacenter"
  | "static_residential"
  | "rotating_residential";

/** How the customer buys a product. */
export type BillingUnit = "proxy" | "bandwidth_gb";

/** Network exclusivity tier — maps onto a Webshare proxy_type. */
export type Exclusivity = "shared" | "private" | "dedicated";

/**
 * Standard bandwidth tiers offered for proxy-billed products, mirroring
 * Webshare's subscription page. A proxy that exceeds its tier stops working.
 */
export const STANDARD_BANDWIDTH_TIERS = [250, 1000, 5000] as const;

/**
 * Webshare enforces a minimum of 3 sub-users on every plan. We no longer
 * resell sub-user seats as an add-on, but the pricing query still has to
 * carry this minimum or Webshare rejects the request.
 */
export const MIN_SUBUSERS = 3;

/**
 * Upper guardrail for a Recurring Replacement frequency, in seconds.
 * 366 days — comfortably above the slowest preset (monthly).
 */
export const RECURRING_FREQUENCY_MAX = 366 * 24 * 60 * 60;

/** Upper guardrails for the resold add-ons. */
export const ADDON_CAPS = {
  proxyReplacements: 5000,
  automaticRefreshFrequency: RECURRING_FREQUENCY_MAX,
} as const;

/** Raw customization object sent from the checkout UI. */
export interface RawCheckoutConfig {
  type?: string;
  qty?: number | string;
  quantity?: number | string;
  /** GB of bandwidth — only used by 'bandwidth_gb' products. */
  gb?: number | string;
  /** Legacy boolean — superseded by `exclusivity`, kept for back-compat. */
  dedicated?: boolean;
  /** "shared" | "private" | "dedicated". */
  exclusivity?: string;
  country?: string; // "WW" (worldwide mix) or an ISO-3166 alpha-2 code
  unlimited?: boolean;
  /** Chosen standard bandwidth tier (proxy-billed products). */
  standardGb?: number | string;
  /** Add-on: Manual Replacements — proxy replacements included. */
  proxyReplacements?: number | string;
  /** Add-on: Recurring Replacements — auto-refresh frequency, in seconds. */
  automaticRefreshFrequency?: number | string;
  /** Add-on: high-priority network upgrade. */
  highPriorityNetwork?: boolean;
}

/** A validated, clamped configuration. */
export interface CheckoutConfig {
  type: ProductType;
  /** Proxy count. For a 'bandwidth_gb' product this is the fixed pool size. */
  qty: number;
  /** GB of bandwidth purchased. 0 for 'proxy'-billed products. */
  gb: number;
  /** Back-compat mirror of `exclusivity === "dedicated"`. */
  dedicated: boolean;
  exclusivity: Exclusivity;
  country: string; // "WW" or an uppercase ISO-3166 alpha-2 code
  unlimited: boolean;
  /** Resolved standard bandwidth tier in GB (proxy-billed products). */
  standardGb: number;
  /** Manual Replacements — proxy replacements included. */
  proxyReplacements: number;
  /** Recurring Replacements — auto-refresh frequency, in seconds (0 = off). */
  automaticRefreshFrequency: number;
  highPriorityNetwork: boolean;
}

/** One row of public.proxy_configuration_rules. */
export interface ConfigurationRule {
  product_type: ProductType;
  display_label: string;
  margin_multiplier: number | string;
  /** LEGACY single subtype — kept only as a fallback. */
  webshare_proxy_subtype: string;
  /** Webshare proxy_subtype for the Shared exclusivity. */
  webshare_subtype_shared: string;
  /** Webshare proxy_subtype for the Dedicated exclusivity. */
  webshare_subtype_dedicated: string;
  webshare_type_shared: string;
  webshare_type_dedicated: string;
  /** Private (semi-dedicated) exclusivity mapping — migration 016. */
  supports_private?: boolean;
  webshare_type_private?: string | null;
  webshare_subtype_private?: string | null;
  pricing_term: string;
  standard_bandwidth_gb: number;
  webshare_query_defaults: Record<string, unknown> | null;
  supports_dedicated: boolean;
  supports_country_targeting: boolean;
  supports_unlimited_bandwidth: boolean;
  min_quantity: number;
  max_quantity: number;
  /** 'proxy' = customer picks an IP count; 'bandwidth_gb' = picks GB. */
  billing_unit: BillingUnit;
  /** Gateway proxies provisioned for a bandwidth_gb plan. */
  bandwidth_pool_size: number;
  /** GB guardrails for a bandwidth_gb product. */
  min_gb: number;
  max_gb: number;
  default_gb: number;
}

export interface PriceAddons {
  proxyReplacements: number;
  automaticRefreshFrequency: number;
  highPriorityNetwork: boolean;
}

/** The fully resolved price + the inputs that produced it. */
export interface PriceBreakdown {
  productType: ProductType;
  displayLabel: string;
  /** How this product is billed. */
  billingUnit: BillingUnit;
  /** Proxy count (the fixed pool size for a bandwidth_gb product). */
  quantity: number;
  /** GB of bandwidth purchased. 0 for 'proxy'-billed products. */
  gb: number;
  dedicated: boolean;
  exclusivity: Exclusivity;
  /** "ZZ" == worldwide mix, otherwise an ISO-3166 alpha-2 code. */
  country: string;
  unlimitedBandwidth: boolean;
  /** Standard bandwidth tier in GB (0 when Unlimited). */
  standardGb: number;
  addons: PriceAddons;
  term: string;
  /** Live wholesale cost returned by Webshare, in USD. */
  wholesaleCost: number;
  /** Structural markup applied (confidential — never expose to the browser). */
  marginMultiplier: number;
  /** Retail price charged to the customer, in USD. */
  retailPrice: number;
  currency: "usd";
  /** The exact query object sent to Webshare (kept for auditing). */
  webshareQuery: Record<string, unknown>;
}

export interface WebsharePricingOptions {
  apiKey: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://proxy.webshare.io/api/v2";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Floor + clamp an arbitrary value to an integer in [min, max]. */
function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  let n = Math.floor(Number(v));
  if (!Number.isFinite(n)) n = fallback;
  return Math.min(max, Math.max(min, n));
}

/** Snap a requested standard-bandwidth value to the nearest offered tier. */
function resolveStandardGb(raw: unknown, fallback: number): number {
  let n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) n = fallback;
  const tiers = STANDARD_BANDWIDTH_TIERS as readonly number[];
  if (tiers.includes(n)) return n;
  return tiers.reduce(
    (best, t) => (Math.abs(t - n) < Math.abs(best - n) ? t : best),
    tiers[0],
  );
}

/** Resolve the requested exclusivity against what the product supports. */
function resolveExclusivity(
  raw: RawCheckoutConfig,
  rule: ConfigurationRule,
): Exclusivity {
  let want: Exclusivity =
    raw?.exclusivity === "dedicated" ||
      raw?.exclusivity === "private" ||
      raw?.exclusivity === "shared"
      ? (raw.exclusivity as Exclusivity)
      : raw?.dedicated
      ? "dedicated"
      : "shared";

  if (want === "dedicated" && !rule.supports_dedicated) want = "private";
  if (want === "private" && !rule.supports_private) want = "shared";
  return want;
}

/**
 * Validate + clamp a raw config object against a product's rule row.
 * Anything the product does not support is forced to a safe default so a
 * tampered payload can never widen what the customer is allowed to buy.
 */
export function normalizeConfig(
  raw: RawCheckoutConfig,
  rule: ConfigurationRule,
): CheckoutConfig {
  const isBandwidth = rule.billing_unit === "bandwidth_gb";

  let qty: number;
  let gb: number;

  if (isBandwidth) {
    // The customer buys GB; the proxy count is a fixed gateway pool that
    // the client cannot influence.
    qty = Math.max(1, Math.floor(Number(rule.bandwidth_pool_size)) || 1);
    gb = Math.floor(Number(raw?.gb ?? rule.default_gb));
    if (!Number.isFinite(gb)) gb = rule.default_gb;
    gb = Math.min(rule.max_gb, Math.max(rule.min_gb, gb));
  } else {
    qty = Math.floor(Number(raw?.qty ?? raw?.quantity ?? rule.min_quantity));
    if (!Number.isFinite(qty)) qty = rule.min_quantity;
    qty = Math.min(rule.max_quantity, Math.max(rule.min_quantity, qty));
    gb = 0;
  }

  const exclusivity = resolveExclusivity(raw, rule);
  const unlimited = rule.supports_unlimited_bandwidth
    ? Boolean(raw?.unlimited)
    : false;
  const standardGb = resolveStandardGb(
    raw?.standardGb,
    rule.standard_bandwidth_gb,
  );

  // Add-ons. Proxy-list features (Manual + Recurring Replacements and the
  // high-priority network) are only valid on proxy-billed products; on a
  // bandwidth_gb product they are forced off so a tampered payload cannot
  // break the Webshare pricing call.
  const proxyReplacements = isBandwidth
    ? 0
    : clampInt(raw?.proxyReplacements, 0, 0, ADDON_CAPS.proxyReplacements);
  const automaticRefreshFrequency = isBandwidth
    ? 0
    : clampInt(
      raw?.automaticRefreshFrequency,
      0,
      0,
      ADDON_CAPS.automaticRefreshFrequency,
    );
  const highPriorityNetwork = isBandwidth
    ? false
    : Boolean(raw?.highPriorityNetwork);

  let country = String(raw?.country ?? "WW").toUpperCase().trim();
  if (!rule.supports_country_targeting) country = "WW";
  if (country !== "WW" && !/^[A-Z]{2}$/.test(country)) country = "WW";

  return {
    type: rule.product_type,
    qty,
    gb,
    dedicated: exclusivity === "dedicated",
    exclusivity,
    country,
    unlimited,
    standardGb,
    proxyReplacements,
    automaticRefreshFrequency,
    highPriorityNetwork,
  };
}

/**
 * Translate a validated config into the JSON query object that Webshare's
 * GET /api/v2/subscription/pricing/ endpoint expects.
 */
export function buildWebsharePricingQuery(
  rule: ConfigurationRule,
  config: CheckoutConfig,
): Record<string, unknown> {
  // proxy_type AND proxy_subtype both depend on the exclusivity tier.
  // Webshare only accepts certain subtypes per type (e.g. proxy_type
  // "dedicated" rejects "default" — it needs "premium" or "isp").
  let proxyType: string;
  let proxySubtype: string;
  if (config.exclusivity === "dedicated") {
    proxyType = rule.webshare_type_dedicated;
    proxySubtype = rule.webshare_subtype_dedicated ||
      rule.webshare_proxy_subtype;
  } else if (config.exclusivity === "private") {
    proxyType = rule.webshare_type_private || rule.webshare_type_dedicated;
    proxySubtype = rule.webshare_subtype_private ||
      rule.webshare_subtype_dedicated ||
      rule.webshare_proxy_subtype;
  } else {
    proxyType = rule.webshare_type_shared;
    proxySubtype = rule.webshare_subtype_shared || rule.webshare_proxy_subtype;
  }

  // "ZZ" tells Webshare to allocate the country randomly (worldwide mix).
  const countryCode = config.country === "WW" ? "ZZ" : config.country;

  // A 'bandwidth_gb' product sends the customer's chosen GB directly as
  // bandwidth_limit. A 'proxy' product sends 0 for the Unlimited upgrade,
  // otherwise the chosen standard bandwidth tier.
  const bandwidthLimit = rule.billing_unit === "bandwidth_gb"
    ? config.gb
    : config.unlimited
    ? 0
    : config.standardGb;

  return {
    behavior: "replace",
    proxy_type: proxyType,
    proxy_subtype: proxySubtype,
    proxy_countries: { [countryCode]: config.qty },
    bandwidth_limit: bandwidthLimit,
    // On-demand refreshes are no longer resold — Webshare rejects this
    // field above 0 for these plans, so it is pinned at 0.
    on_demand_refreshes_total: 0,
    // Recurring Replacements add-on — auto-refresh frequency in seconds.
    automatic_refresh_frequency: config.automaticRefreshFrequency,
    // Manual Replacements add-on.
    proxy_replacements_total: config.proxyReplacements,
    // Sub-user seats are not resold; carry Webshare's required minimum.
    subusers_total: MIN_SUBUSERS,
    term: rule.pricing_term,
    is_unlimited_ip_authorizations: false,
    is_high_concurrency: false,
    is_high_priority_network: config.highPriorityNetwork,
    high_quality_ips_only: false,
    with_tax: false,
    // Per-product static overrides (admin-editable) win last.
    ...(rule.webshare_query_defaults ?? {}),
  };
}

/**
 * Call Webshare's live pricing endpoint and return the wholesale cost (USD).
 * The endpoint JSON-encodes the whole request into a single `query` GET param.
 */
export async function fetchWebshareWholesaleCost(
  query: Record<string, unknown>,
  opts: WebsharePricingOptions,
): Promise<number> {
  if (!opts.apiKey) {
    throw new Error("Webshare API key is not configured");
  }
  const base = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = `${base}/subscription/pricing/?query=${
    encodeURIComponent(JSON.stringify(query))
  }`;

  const res = await fetch(url, {
    headers: { Authorization: `Token ${opts.apiKey}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Webshare pricing request failed (HTTP ${res.status})` +
        (detail ? `: ${detail.slice(0, 240)}` : ""),
    );
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  // `price` is the post-discount price for the requested term.
  const price = Number((data as Record<string, unknown>)?.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(
      "Webshare pricing response did not contain a usable `price` value",
    );
  }
  return price;
}

/**
 * End-to-end: validate the config, fetch the live wholesale cost, and apply
 * the product's structural margin to produce the retail price. The margin
 * is applied to the full wholesale cost — add-ons included — so every
 * resold add-on carries the same structural markup.
 */
export async function priceCheckout(
  rule: ConfigurationRule,
  rawConfig: RawCheckoutConfig,
  opts: WebsharePricingOptions,
): Promise<PriceBreakdown> {
  const config = normalizeConfig(rawConfig, rule);
  const query = buildWebsharePricingQuery(rule, config);
  const wholesaleCost = await fetchWebshareWholesaleCost(query, opts);

  const marginMultiplier = Number(rule.margin_multiplier);
  if (!Number.isFinite(marginMultiplier) || marginMultiplier < 1) {
    throw new Error(
      `Invalid margin multiplier for ${rule.product_type}: ${rule.margin_multiplier}`,
    );
  }

  const retailPrice = round2(wholesaleCost * marginMultiplier);

  return {
    productType: config.type,
    displayLabel: rule.display_label,
    billingUnit: rule.billing_unit,
    quantity: config.qty,
    gb: config.gb,
    dedicated: config.dedicated,
    exclusivity: config.exclusivity,
    country: query.proxy_countries
      ? Object.keys(query.proxy_countries as object)[0]
      : "ZZ",
    unlimitedBandwidth: config.unlimited,
    standardGb: config.unlimited ? 0 : config.standardGb,
    addons: {
      proxyReplacements: config.proxyReplacements,
      automaticRefreshFrequency: config.automaticRefreshFrequency,
      highPriorityNetwork: config.highPriorityNetwork,
    },
    term: rule.pricing_term,
    wholesaleCost: round2(wholesaleCost),
    marginMultiplier,
    retailPrice,
    currency: "usd",
    webshareQuery: query,
  };
}
