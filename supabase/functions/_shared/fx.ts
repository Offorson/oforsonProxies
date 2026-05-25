// =============================================================
// Live FX conversion  (Supabase Edge Functions / Deno)
// -------------------------------------------------------------
// Converts our USD retail price into the customer's local currency
// using a LIVE exchange-rate feed.
//
// Rate source (in priority order):
//   1. FX_RATES_URL            — any USD-base feed returning
//                                { rates: { CUR: number } }
//   2. OPENEXCHANGERATES_APP_ID — openexchangerates.org (hourly)
//   3. default: open.er-api.com — free, no key, ~daily refresh
//
// Rates are cached in-memory for 10 minutes per warm instance.
//
// Keep in sync with src/lib/pricing/fx.ts.
// =============================================================

export interface FxConversion {
  /** Target currency (uppercase ISO code). */
  currency: string;
  /** Raw live market rate (units of `currency` per 1 USD at fetch time). */
  rate: number;
  /** FX buffer percentage folded into `amount` (0 for USD). */
  bufferPct: number;
  /** amountUsd * rate * (1 + bufferPct/100), rounded to 2 decimal places. */
  amount: number;
  /** Which feed the rate came from. */
  source: string;
  /** ISO timestamp the rate was applied. */
  fetchedAt: string;
}

export interface FxOptions {
  /** openexchangerates.org app id (hourly updates). */
  oxrAppId?: string;
  /** Fully custom USD-base rates endpoint. */
  customUrl?: string;
  /**
   * Percentage padding added on top of the live rate to absorb FX drift
   * between charge and settlement. Defaults to 4 via fxOptionsFromEnv().
   */
  bufferPct?: number;
}

const FREE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Default FX buffer when FX_BUFFER_PCT is not set. */
const DEFAULT_FX_BUFFER_PCT = 4;

/** Clamp the buffer to a sane range so a misconfigured value can't run wild. */
function clampBufferPct(pct: unknown): number {
  const n = Number(pct);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 25);
}

let cache: { rates: Record<string, number>; source: string; at: number } | null =
  null;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function resolveEndpoint(opts: FxOptions): { url: string; source: string } {
  if (opts.customUrl) return { url: opts.customUrl, source: "custom" };
  if (opts.oxrAppId) {
    return {
      url:
        `https://openexchangerates.org/api/latest.json?app_id=${opts.oxrAppId}`,
      source: "openexchangerates.org",
    };
  }
  return { url: FREE_ENDPOINT, source: "open.er-api.com" };
}

/** Fetch (and cache) the full USD-base rate table. */
export async function fetchUsdRates(
  opts: FxOptions = {},
): Promise<{ rates: Record<string, number>; source: string }> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { rates: cache.rates, source: cache.source };
  }
  const { url, source } = resolveEndpoint(opts);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FX rate request failed (HTTP ${res.status}) via ${source}`);
  }
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  const rates = ((data as Record<string, unknown>)?.rates ??
    (data as Record<string, unknown>)?.conversion_rates) as
      | Record<string, number>
      | undefined;
  if (!rates || typeof rates !== "object") {
    throw new Error(`FX response via ${source} contained no rates table`);
  }
  cache = { rates, source, at: Date.now() };
  return { rates, source };
}

/**
 * Convert a USD amount into `currency` at the live rate.
 * USD passes through untouched (rate 1).
 */
export async function convertUsd(
  amountUsd: number,
  currency: string,
  opts: FxOptions = {},
): Promise<FxConversion> {
  const cur = String(currency ?? "USD").trim().toUpperCase();
  const fetchedAt = new Date().toISOString();
  const bufferPct = clampBufferPct(opts.bufferPct);

  if (cur === "USD") {
    // USD carries no FX risk, so the buffer is never applied to it.
    return {
      currency: "USD",
      rate: 1,
      bufferPct: 0,
      amount: round2(amountUsd),
      source: "none",
      fetchedAt,
    };
  }

  const { rates, source } = await fetchUsdRates(opts);
  const rate = Number(rates[cur]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No live FX rate available for ${cur}`);
  }
  // The buffer pads the converted amount so FX movement between charge and
  // settlement does not erode margin. `rate` stays the raw market rate.
  const amount = round2(amountUsd * rate * (1 + bufferPct / 100));
  return { currency: cur, rate, bufferPct, amount, source, fetchedAt };
}

/** Build FxOptions from the standard Deno environment variables. */
export function fxOptionsFromEnv(): FxOptions {
  const rawBuffer = Deno.env.get("FX_BUFFER_PCT");
  return {
    oxrAppId: Deno.env.get("OPENEXCHANGERATES_APP_ID") || undefined,
    customUrl: Deno.env.get("FX_RATES_URL") || undefined,
    bufferPct:
      rawBuffer == null || rawBuffer.trim() === ""
        ? DEFAULT_FX_BUFFER_PCT
        : Number(rawBuffer),
  };
}
