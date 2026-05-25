/**
 * Live FX conversion (Next.js / Node runtime).
 *
 * Keep in sync with supabase/functions/_shared/fx.ts.
 */

export interface FxConversion {
  currency: string;
  rate: number;
  bufferPct: number;
  amount: number;
  source: string;
  fetchedAt: string;
}

export interface FxOptions {
  oxrAppId?: string;
  customUrl?: string;
  bufferPct?: number;
}

const FREE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_FX_BUFFER_PCT = 4;

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
      url: `https://openexchangerates.org/api/latest.json?app_id=${opts.oxrAppId}`,
      source: "openexchangerates.org",
    };
  }
  return { url: FREE_ENDPOINT, source: "open.er-api.com" };
}

export async function fetchUsdRates(
  opts: FxOptions = {}
): Promise<{ rates: Record<string, number>; source: string }> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { rates: cache.rates, source: cache.source };
  }
  const { url, source } = resolveEndpoint(opts);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`FX rate request failed (HTTP ${res.status}) via ${source}`);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const rates = (data?.rates ?? data?.conversion_rates) as
    | Record<string, number>
    | undefined;
  if (!rates || typeof rates !== "object") {
    throw new Error(`FX response via ${source} contained no rates table`);
  }
  cache = { rates, source, at: Date.now() };
  return { rates, source };
}

export async function convertUsd(
  amountUsd: number,
  currency: string,
  opts: FxOptions = {}
): Promise<FxConversion> {
  const cur = String(currency ?? "USD").trim().toUpperCase();
  const fetchedAt = new Date().toISOString();
  const bufferPct = clampBufferPct(opts.bufferPct);

  if (cur === "USD") {
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
  const amount = round2(amountUsd * rate * (1 + bufferPct / 100));
  return { currency: cur, rate, bufferPct, amount, source, fetchedAt };
}

export function fxOptionsFromEnv(): FxOptions {
  const rawBuffer = process.env.FX_BUFFER_PCT;
  return {
    oxrAppId: process.env.OPENEXCHANGERATES_APP_ID || undefined,
    customUrl: process.env.FX_RATES_URL || undefined,
    bufferPct:
      rawBuffer == null || rawBuffer.trim() === ""
        ? DEFAULT_FX_BUFFER_PCT
        : Number(rawBuffer),
  };
}
