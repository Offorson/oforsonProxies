"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bitcoin,
  Check,
  ChevronDown,
  CreditCard,
  Globe,
  Info,
  Landmark,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TrendingDown,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { COUNTRIES } from "@/constants/plans";
import {
  PRODUCT_OPTIONS,
  WORLDWIDE,
  STANDARD_BANDWIDTH_TIERS,
  RECURRING_REPLACEMENT_PRESETS,
  RECURRING_CUSTOM_UNITS,
  MANUAL_REPLACEMENT_PRESETS,
  MANUAL_REPLACEMENT_MAX,
} from "@/constants/proxy-config";
import { enabledPaystackCurrencies } from "@/constants/currencies";
import { AddonInfoPanel, type AddonFaqId } from "@/components/billing/addons-info";
import type { CheckoutConfig, Exclusivity, PriceQuote, ProxyType } from "@/types";

type PayMethod = "crypto" | "card" | "bank_transfer";

const CURRENCIES = enabledPaystackCurrencies();

const BANK_TRANSFER_CURRENCY = "NGN";

/** Network exclusivity tiers, with the plain-language explainer shown in-UI. */
const EXCLUSIVITY_OPTIONS: {
  value: Exclusivity;
  label: string;
  desc: string;
}[] = [
  {
    value: "shared",
    label: "Shared",
    desc: "Pooled IPs — shared with more than two other users.",
  },
  {
    value: "private",
    label: "Private",
    desc: "Semi-dedicated — a small private pool, only a couple of users.",
  },
  {
    value: "dedicated",
    label: "Dedicated",
    desc: "Fully yours — these IPs are owned by you and nobody else.",
  },
];

function money(n: number, currency: string): string {
  try {
    return n.toLocaleString("en-US", { style: "currency", currency });
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function perUnitMoney(n: number, currency: string): string {
  const digits = n > 0 && n < 1 ? 4 : 2;
  try {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    });
  } catch {
    return `${currency} ${n.toFixed(digits)}`;
  }
}

/** "250 GB", "1 TB", "5 TB". */
function tierLabel(gb: number): string {
  return gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000} TB` : `${gb} GB`;
}

/** Human-readable label for a recurring-replacement frequency (in seconds). */
function describeFrequency(seconds: number): string {
  if (seconds <= 0) return "No refreshes";
  const preset = RECURRING_REPLACEMENT_PRESETS.find(
    (p) => p.seconds === seconds
  );
  if (preset) return preset.label;
  for (const u of RECURRING_CUSTOM_UNITS) {
    if (seconds % u.seconds === 0) {
      const n = seconds / u.seconds;
      return `Every ${n} ${u.label}${n === 1 ? "" : "s"}`;
    }
  }
  return `Every ${seconds}s`;
}

/**
 * Turn a raw checkout error into something a customer can act on.
 *
 * The most common one is Paystack's HTTP 403 "Currency not supported by
 * merchant" — that comes back as a raw JSON dump from the edge function.
 * A Paystack account only settles the currencies it has been enabled for,
 * so charging an un-enabled currency always fails until it is turned on
 * in the Paystack dashboard.
 */
function friendlyCheckoutError(raw: string, currency: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("unsupported_currency") ||
    lower.includes("currency not supported by merchant")
  ) {
    return (
      `Card payments in ${currency} aren't enabled on your Paystack ` +
      `account yet, so the charge was declined. Switch the charge currency ` +
      `to NGN to check out right away — or enable ${currency} on Paystack ` +
      `(Settings → Preferences, or contact Paystack support) and try again.`
    );
  }
  return raw;
}

export function CheckoutPanel({ userId }: { userId: string }) {
  const [type, setType] = useState<ProxyType>("datacenter");
  const [exclusivity, setExclusivity] = useState<Exclusivity>("shared");
  const [country, setCountry] = useState<string>(WORLDWIDE);
  const [bandwidthMode, setBandwidthMode] = useState<"standard" | "unlimited">(
    "standard"
  );
  const [standardGb, setStandardGb] = useState<number>(
    STANDARD_BANDWIDTH_TIERS[0]
  );
  const [qty, setQty] = useState(100);
  const [gb, setGb] = useState(50);

  // Add-ons — resold straight from Webshare's subscription page.
  // The "Replacement" add-on stays collapsed until tapped, keeping the
  // panel clean. It bundles two Webshare features:
  //   • Recurring Replacements — auto-refresh frequency, in seconds.
  //   • Manual Replacements    — a pool of one-off proxy swaps.
  const [replacementOpen, setReplacementOpen] = useState(false);

  const [recurringMode, setRecurringMode] = useState<"preset" | "custom">(
    "preset"
  );
  const [recurringSeconds, setRecurringSeconds] = useState(0);
  const [recurringDraftValue, setRecurringDraftValue] = useState(0);
  const [recurringDraftUnit, setRecurringDraftUnit] = useState(
    RECURRING_CUSTOM_UNITS[0].label
  );

  const [manualMode, setManualMode] = useState<"preset" | "custom">("preset");
  const [manualReplacements, setManualReplacements] = useState(0);
  const [manualDraftValue, setManualDraftValue] = useState(0);

  const [highPriorityNetwork, setHighPriorityNetwork] = useState(false);

  // In-app add-on guide — opened from the info icons. It renders over the
  // billing page without unmounting it, so checkout state is preserved.
  const [faqOpen, setFaqOpen] = useState(false);
  const [faqFocus, setFaqFocus] = useState<AddonFaqId | null>(null);
  const openFaq = useCallback((id: AddonFaqId) => {
    setFaqFocus(id);
    setFaqOpen(true);
  }, []);

  const [payMethod, setPayMethod] = useState<PayMethod>("crypto");
  const [currency, setCurrency] = useState<string>(CURRENCIES[0]?.code ?? "USD");

  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const product = useMemo(
    () => PRODUCT_OPTIONS.find((p) => p.id === type) ?? PRODUCT_OPTIONS[0],
    [type]
  );

  const isBandwidth = product.billingUnit === "bandwidth_gb";
  const unitLabel = isBandwidth ? "GB" : "proxy";
  const offersExclusivity = product.supportsDedicated || product.supportsPrivate;

  const chargeCurrency =
    payMethod === "card"
      ? currency
      : payMethod === "bank_transfer"
        ? BANK_TRANSFER_CURRENCY
        : "USD";

  const isPaystack = payMethod === "card" || payMethod === "bank_transfer";

  /** Seconds represented by the current custom recurring draft. */
  const recurringDraftSeconds = useMemo(() => {
    const unit =
      RECURRING_CUSTOM_UNITS.find((u) => u.label === recurringDraftUnit) ??
      RECURRING_CUSTOM_UNITS[0];
    return Math.max(0, Math.floor(recurringDraftValue)) * unit.seconds;
  }, [recurringDraftValue, recurringDraftUnit]);

  function selectType(next: ProxyType) {
    const p = PRODUCT_OPTIONS.find((x) => x.id === next) ?? PRODUCT_OPTIONS[0];
    setType(next);
    setQty((q) => Math.min(p.maxQuantity, Math.max(p.minQuantity, q)));
    setGb((g) => Math.min(p.maxGb, Math.max(p.minGb, g || p.defaultGb)));
    setExclusivity((prev) => {
      if (prev === "dedicated" && !p.supportsDedicated)
        return p.supportsPrivate ? "private" : "shared";
      if (prev === "private" && !p.supportsPrivate) return "shared";
      return prev;
    });
    if (!p.supportsUnlimitedBandwidth) setBandwidthMode("standard");
    if (!p.supportsCountryTargeting) setCountry(WORLDWIDE);
  }

  // ---- Recurring Replacements handlers --------------------------------
  function pickRecurringPreset(seconds: number) {
    setRecurringMode("preset");
    setRecurringSeconds(seconds);
  }
  function pickRecurringCustom() {
    setRecurringMode("custom");
    // Selecting Custom applies whatever is currently in the draft (0 by
    // default — i.e. no refresh) until the customer Saves a value.
    setRecurringSeconds(recurringDraftSeconds);
  }
  function saveRecurringCustom() {
    setRecurringSeconds(recurringDraftSeconds);
  }

  // ---- Manual Replacements handlers -----------------------------------
  function pickManualPreset(count: number) {
    setManualMode("preset");
    setManualReplacements(count);
  }
  function pickManualCustom() {
    setManualMode("custom");
    setManualReplacements(Math.min(MANUAL_REPLACEMENT_MAX, manualDraftValue));
  }
  function saveManualCustom() {
    setManualReplacements(Math.min(MANUAL_REPLACEMENT_MAX, manualDraftValue));
  }

  const config: CheckoutConfig = useMemo(
    () => ({
      type,
      qty: isBandwidth ? product.bandwidthPoolSize : qty,
      gb: isBandwidth ? gb : 0,
      dedicated: product.supportsDedicated && exclusivity === "dedicated",
      exclusivity: offersExclusivity ? exclusivity : "shared",
      country: product.supportsCountryTargeting ? country : WORLDWIDE,
      unlimited:
        product.supportsUnlimitedBandwidth && bandwidthMode === "unlimited",
      standardGb,
      proxyReplacements: isBandwidth ? 0 : manualReplacements,
      automaticRefreshFrequency: isBandwidth ? 0 : recurringSeconds,
      highPriorityNetwork: isBandwidth ? false : highPriorityNetwork,
    }),
    [
      type,
      qty,
      gb,
      exclusivity,
      offersExclusivity,
      country,
      bandwidthMode,
      standardGb,
      manualReplacements,
      recurringSeconds,
      highPriorityNetwork,
      product,
      isBandwidth,
    ]
  );

  const sizeValue = isBandwidth ? gb : qty;
  const sizeMin = isBandwidth ? product.minGb : product.minQuantity;

  useEffect(() => {
    if (!Number.isFinite(sizeValue) || sizeValue < sizeMin) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const res = await fetch("/api/billing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...config, currency: chargeCurrency }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok)
          throw new Error(json.error || "Could not price this configuration");
        setQuote(json.quote as PriceQuote);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setQuote(null);
        setQuoteError(
          e instanceof Error ? e.message : "Could not price this configuration"
        );
      } finally {
        setQuoteLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [config, sizeValue, sizeMin, chargeCurrency]);

  const purchase = useCallback(async () => {
    setCheckoutError(null);
    if (!userId) {
      setCheckoutError("You need to be signed in to place an order.");
      return;
    }
    setCheckoutLoading(true);
    try {
      const supabase = createClient();
      const fnName =
        payMethod === "crypto"
          ? "create-crypto-checkout"
          : "create-paystack-checkout";

      const body =
        payMethod === "card"
          ? { user_id: userId, config, currency }
          : payMethod === "bank_transfer"
            ? {
                user_id: userId,
                config,
                currency: BANK_TRANSFER_CURRENCY,
                payment_channel: "bank_transfer",
              }
            : { user_id: userId, config };

      const { data, error: fnErr } = await supabase.functions.invoke(fnName, {
        body,
      });

      if (fnErr) {
        let msg = fnErr.message || "Checkout failed";
        const ctx = (fnErr as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const errBody = await ctx.json();
            if (errBody?.error) msg = errBody.error;
          } catch {
            /* keep the generic message */
          }
        }
        throw new Error(msg);
      }

      const redirectUrl =
        (data as { invoice_url?: string; authorization_url?: string } | null)
          ?.invoice_url ??
        (data as { authorization_url?: string } | null)?.authorization_url;

      if (!redirectUrl) {
        throw new Error(
          (data as { error?: string } | null)?.error ??
            "Checkout did not return a redirect URL."
        );
      }
      window.location.href = redirectUrl;
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Checkout failed";
      setCheckoutError(friendlyCheckoutError(raw, chargeCurrency));
      setCheckoutLoading(false);
    }
  }, [userId, config, payMethod, currency, chargeCurrency]);

  const countryLabel =
    country === WORLDWIDE
      ? "Worldwide mix"
      : COUNTRIES.find((c) => c.code === country)?.name ?? country;

  const showCharge = isPaystack && !!quote?.charge;
  const displayAmount = showCharge
    ? quote!.charge!.amount
    : quote?.retailPrice ?? 0;
  const displayCurrency = showCharge ? quote!.charge!.currency : "USD";

  const perUnit = useMemo(() => {
    if (!quote) return null;
    const denom =
      quote.billingUnit === "bandwidth_gb" ? quote.gb : quote.quantity;
    if (!denom || denom <= 0) return null;
    return {
      amount: displayAmount / denom,
      currency: displayCurrency,
      unit: quote.billingUnit === "bandwidth_gb" ? "GB" : "proxy",
    };
  }, [quote, displayAmount, displayCurrency]);

  const summaryTitle = isBandwidth
    ? `${gb} GB · ${product.name}`
    : `${qty.toLocaleString()} ${product.name}`;

  const bandwidthLabel =
    bandwidthMode === "unlimited"
      ? "Unlimited bandwidth"
      : `${tierLabel(standardGb)} bandwidth`;

  const addonSummary = [
    !isBandwidth && recurringSeconds > 0
      ? `${describeFrequency(recurringSeconds)} refresh`
      : null,
    !isBandwidth && manualReplacements > 0
      ? `${manualReplacements.toLocaleString()} manual replacements`
      : null,
    !isBandwidth && highPriorityNetwork ? "high-priority network" : null,
  ].filter(Boolean) as string[];

  // One-line summary for the collapsed Replacement add-on.
  const replacementSummary = [
    recurringSeconds > 0
      ? `${describeFrequency(recurringSeconds)} refresh`
      : "No auto-refresh",
    manualReplacements > 0
      ? `${manualReplacements.toLocaleString()} manual`
      : "no manual swaps",
  ].join(" · ");

  return (
    <>
      <Card className="border-brand-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-600 text-white">
              <Globe className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Buy proxies</CardTitle>
              <CardDescription>
                Customize your package — price updates live, and the more you
                buy the lower your per-unit rate.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Proxy type */}
          <div>
            <label className="text-sm font-medium text-ink-800">
              Proxy type
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {PRODUCT_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectType(p.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    type === p.id
                      ? "border-brand-400 bg-brand-50/50 ring-2 ring-brand-500/10"
                      : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <p className="text-sm font-medium text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-500">{p.tagline}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Country + quantity / bandwidth */}
          <div className="grid gap-5 sm:grid-cols-2">
            {product.supportsCountryTargeting && (
              <div>
                <label className="text-sm font-medium text-ink-800">
                  Country location
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="input mt-1.5"
                >
                  <option value={WORLDWIDE}>Worldwide mix</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isBandwidth && (
              <div>
                <label className="text-sm font-medium text-ink-800">
                  Quantity ({product.minQuantity.toLocaleString()}–
                  {product.maxQuantity.toLocaleString()})
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={product.minQuantity}
                  max={product.maxQuantity}
                  value={qty === 0 ? "" : qty}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .replace(/^0+/, "");
                    setQty(
                      digits === ""
                        ? 0
                        : Math.min(product.maxQuantity, Number(digits))
                    );
                  }}
                  onBlur={() =>
                    setQty((q) =>
                      Math.min(
                        product.maxQuantity,
                        Math.max(product.minQuantity, q || product.minQuantity)
                      )
                    )
                  }
                  className="input mt-1.5"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Per-proxy price drops as the quantity goes up.
                </p>
                {type === "datacenter" && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-brand-600">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    Datacenter has a minimum order — 1 to 10 proxies are priced
                    the same, so 10 gives the best value per proxy.
                  </p>
                )}
              </div>
            )}

            {isBandwidth && (
              <div>
                <label className="text-sm font-medium text-ink-800">
                  Bandwidth ({product.minGb}-{product.maxGb} GB)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={product.minGb}
                  max={product.maxGb}
                  value={gb === 0 ? "" : gb}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .replace(/^0+/, "");
                    setGb(
                      digits === ""
                        ? 0
                        : Math.min(product.maxGb, Number(digits))
                    );
                  }}
                  onBlur={() =>
                    setGb((g) =>
                      Math.min(
                        product.maxGb,
                        Math.max(product.minGb, g || product.defaultGb)
                      )
                    )
                  }
                  className="input mt-1.5"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Rotating residential is metered by GB. Per-GB price drops as
                  you buy more.
                </p>
              </div>
            )}
          </div>

          {/* Network exclusivity */}
          {offersExclusivity && (
            <div>
              <label className="text-sm font-medium text-ink-800">
                Network exclusivity
              </label>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                {EXCLUSIVITY_OPTIONS.map((o) => {
                  const disabled =
                    (o.value === "dedicated" && !product.supportsDedicated) ||
                    (o.value === "private" && !product.supportsPrivate);
                  if (disabled) return null;
                  const active = exclusivity === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setExclusivity(o.value)}
                      className={`rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-brand-400 bg-brand-50/50 ring-2 ring-brand-500/10"
                          : "border-ink-200 hover:border-ink-300"
                      }`}
                    >
                      <p className="text-sm font-medium text-ink-900">
                        {o.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-ink-500">
                        {o.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bandwidth tier (proxy-billed products) */}
          {product.supportsUnlimitedBandwidth && !isBandwidth && (
            <div>
              <label className="text-sm font-medium text-ink-800">
                Bandwidth
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STANDARD_BANDWIDTH_TIERS.map((g) => {
                  const active =
                    bandwidthMode === "standard" && standardGb === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setBandwidthMode("standard");
                        setStandardGb(g);
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "border-brand-400 bg-brand-50/50 text-ink-900 ring-2 ring-brand-500/10"
                          : "border-ink-200 text-ink-600 hover:border-ink-300"
                      }`}
                    >
                      {tierLabel(g)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setBandwidthMode("unlimited")}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    bandwidthMode === "unlimited"
                      ? "border-brand-400 bg-brand-50/50 text-ink-900 ring-2 ring-brand-500/10"
                      : "border-ink-200 text-ink-600 hover:border-ink-300"
                  }`}
                >
                  Unlimited
                </button>
              </div>
              <p className="mt-1 flex items-start gap-1 text-xs text-ink-400">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                {bandwidthMode === "unlimited"
                  ? "No bandwidth cap — proxies never throttle."
                  : "If a proxy goes over its bandwidth tier it stops working until the plan renews."}
              </p>
            </div>
          )}

          {/* Add-ons (proxy-billed products only) */}
          {!isBandwidth && (
            <div className="rounded-xl border border-ink-200 p-4">
              <p className="text-sm font-medium text-ink-800">Add-ons</p>
              <p className="text-xs text-ink-500">
                Optional extras — add what you need and the price updates
                instantly.
              </p>
              <div className="mt-3 space-y-3">
                {/* Replacement — tap the container to reveal the options. */}
                <div className="rounded-xl border border-ink-200">
                  <button
                    type="button"
                    onClick={() => setReplacementOpen((v) => !v)}
                    aria-expanded={replacementOpen}
                    className="flex w-full items-center justify-between gap-3 p-3.5 text-left"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-ink-400">
                        <RefreshCw className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink-800">
                          Replacement
                        </p>
                        <p className="text-xs text-ink-500">
                          {replacementOpen
                            ? "Auto-refresh on a schedule, plus a pool of manual swaps."
                            : replacementSummary}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${
                        replacementOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {replacementOpen && (
                    <div className="space-y-5 border-t border-ink-100 p-3.5">
                      {/* Recurring Replacements */}
                      <div>
                        <AddonSectionHeading
                          title="Recurring Replacements"
                          desc="Auto-refresh your whole proxy list on a schedule."
                          onInfo={() => openFaq("recurring")}
                        />
                        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {RECURRING_REPLACEMENT_PRESETS.map((p) => (
                            <OptionTile
                              key={p.label}
                              label={p.label}
                              popular={p.popular}
                              active={
                                recurringMode === "preset" &&
                                recurringSeconds === p.seconds
                              }
                              onClick={() => pickRecurringPreset(p.seconds)}
                            />
                          ))}
                          <OptionTile
                            label="Custom"
                            active={recurringMode === "custom"}
                            onClick={pickRecurringCustom}
                          />
                        </div>

                        {recurringMode === "custom" && (
                          <div className="mt-2.5 rounded-xl border border-ink-200 bg-ink-50/60 p-3">
                            <label className="text-xs font-medium text-ink-700">
                              Refresh every
                            </label>
                            <div className="mt-1.5 flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={999}
                                value={
                                  recurringDraftValue === 0
                                    ? ""
                                    : recurringDraftValue
                                }
                                onChange={(e) => {
                                  const digits = e.target.value
                                    .replace(/\D/g, "")
                                    .replace(/^0+/, "");
                                  setRecurringDraftValue(
                                    digits === ""
                                      ? 0
                                      : Math.min(999, Number(digits))
                                  );
                                }}
                                className="input h-9 w-20 py-0 text-center text-sm"
                                aria-label="Custom refresh interval"
                              />
                              <select
                                value={recurringDraftUnit}
                                onChange={(e) =>
                                  setRecurringDraftUnit(e.target.value)
                                }
                                className="input h-9 w-28 py-0 text-sm"
                                aria-label="Custom refresh unit"
                              >
                                {RECURRING_CUSTOM_UNITS.map((u) => (
                                  <option key={u.label} value={u.label}>
                                    {u.label}
                                  </option>
                                ))}
                              </select>
                              <SaveButton
                                onClick={saveRecurringCustom}
                                disabled={
                                  recurringDraftValue < 1 ||
                                  recurringDraftSeconds === recurringSeconds
                                }
                              />
                            </div>
                            <p className="mt-1.5 text-[11px] text-ink-400">
                              Shorter intervals keep your IPs fresher and cost
                              a little more.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Manual Replacements */}
                      <div>
                        <AddonSectionHeading
                          title="Manual Replacements"
                          desc="A pool of one-off swaps you trigger yourself."
                          onInfo={() => openFaq("manual")}
                        />
                        <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          <OptionTile
                            label="None"
                            active={
                              manualMode === "preset" &&
                              manualReplacements === 0
                            }
                            onClick={() => pickManualPreset(0)}
                          />
                          {MANUAL_REPLACEMENT_PRESETS.map((p) => (
                            <OptionTile
                              key={p.count}
                              label={`${p.count.toLocaleString()} IPs`}
                              popular={p.popular}
                              active={
                                manualMode === "preset" &&
                                manualReplacements === p.count
                              }
                              onClick={() => pickManualPreset(p.count)}
                            />
                          ))}
                          <OptionTile
                            label="Custom"
                            active={manualMode === "custom"}
                            onClick={pickManualCustom}
                          />
                        </div>

                        {manualMode === "custom" && (
                          <div className="mt-2.5 rounded-xl border border-ink-200 bg-ink-50/60 p-3">
                            <label className="text-xs font-medium text-ink-700">
                              Custom proxy replacement count
                            </label>
                            <div className="mt-1.5 flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={MANUAL_REPLACEMENT_MAX}
                                value={
                                  manualDraftValue === 0
                                    ? ""
                                    : manualDraftValue
                                }
                                onChange={(e) => {
                                  const digits = e.target.value
                                    .replace(/\D/g, "")
                                    .replace(/^0+/, "");
                                  setManualDraftValue(
                                    digits === ""
                                      ? 0
                                      : Math.min(
                                          MANUAL_REPLACEMENT_MAX,
                                          Number(digits)
                                        )
                                  );
                                }}
                                className="input h-9 w-28 py-0 text-center text-sm"
                                aria-label="Custom replacement count"
                              />
                              <SaveButton
                                onClick={saveManualCustom}
                                disabled={
                                  manualDraftValue < 1 ||
                                  manualDraftValue === manualReplacements
                                }
                              />
                            </div>
                            <p className="mt-1.5 text-[11px] text-ink-400">
                              Up to{" "}
                              {MANUAL_REPLACEMENT_MAX.toLocaleString()}{" "}
                              replacements — unused swaps stay available all
                              plan.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* High-priority network */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-ink-400">
                      <Rocket className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink-800">
                        High-priority network
                      </p>
                      <p className="text-xs text-ink-500">
                        Route over the premium low-latency backbone.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={highPriorityNetwork}
                    aria-label="High-priority network"
                    onClick={() => setHighPriorityNetwork((v) => !v)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      highPriorityNetwork ? "bg-brand-500" : "bg-ink-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        highPriorityNetwork ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs text-emerald-800">
              <span className="font-semibold">Buy more, pay less.</span> Volume
              pricing is automatic — the more {isBandwidth ? "GB" : "proxies"}{" "}
              you add, the lower your per-{unitLabel} rate.
            </p>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-sm font-medium text-ink-800">
              Payment method
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setPayMethod("crypto")}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                  payMethod === "crypto"
                    ? "border-brand-400 bg-brand-50/50 ring-2 ring-brand-500/10"
                    : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                  <Bitcoin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">Crypto</p>
                  <p className="text-xs text-ink-500">BTC, ETH, USDT · USD</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPayMethod("card")}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                  payMethod === "card"
                    ? "border-brand-400 bg-brand-50/50 ring-2 ring-brand-500/10"
                    : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">Card</p>
                  <p className="text-xs text-ink-500">Secure card checkout</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPayMethod("bank_transfer")}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                  payMethod === "bank_transfer"
                    ? "border-brand-400 bg-brand-50/50 ring-2 ring-brand-500/10"
                    : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                  <Landmark className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    Bank transfer
                  </p>
                  <p className="text-xs text-ink-500">
                    NGN · Pay with Transfer
                  </p>
                </div>
              </button>
            </div>

            {payMethod === "card" && (
              <div className="mt-3">
                <label className="text-sm font-medium text-ink-800">
                  Charge currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input mt-1.5"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink-400">
                  Converted from USD at the live exchange rate.
                </p>
              </div>
            )}

            {payMethod === "bank_transfer" && (
              <p className="mt-2 text-xs text-ink-400">
                Charged in Nigerian Naira (₦) via Paystack bank transfer —
                converted from USD at the live exchange rate.
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-3 rounded-xl bg-ink-50 px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-ink-700">
                <p className="font-medium text-ink-900">{summaryTitle}</p>
                <p className="text-xs text-ink-500">
                  {countryLabel}
                  {offersExclusivity
                    ? ` · ${
                        EXCLUSIVITY_OPTIONS.find((o) => o.value === exclusivity)
                          ?.label ?? "Shared"
                      }`
                    : ""}
                  {!isBandwidth ? ` · ${bandwidthLabel}` : ""}
                </p>
                {addonSummary.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    Add-ons: {addonSummary.join(" · ")}
                  </p>
                )}
              </div>
              <div className="text-right">
                {quoteLoading ? (
                  <span className="inline-flex items-center gap-2 text-sm text-ink-500">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" />
                    Pricing...
                  </span>
                ) : quote ? (
                  <>
                    <p className="text-2xl font-bold text-ink-900">
                      {money(displayAmount, displayCurrency)}
                    </p>
                    <p className="text-xs text-ink-500">
                      {showCharge
                        ? `≈ ${money(quote.retailPrice, "USD")} · live FX`
                        : `per ${quote.term === "yearly" ? "year" : "month"}`}
                    </p>
                  </>
                ) : (
                  <span className="text-sm text-ink-400">—</span>
                )}
              </div>
            </div>

            {quote && perUnit && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200/70 pt-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Volume pricing applied
                </span>
                <span className="text-xs text-ink-600">
                  <span className="font-semibold text-ink-900">
                    {perUnitMoney(perUnit.amount, perUnit.currency)}
                  </span>{" "}
                  / {perUnit.unit} · add more to lower this
                </span>
              </div>
            )}

            {quoteError && <p className="text-xs text-rose-600">{quoteError}</p>}
          </div>

          <Button
            onClick={purchase}
            loading={checkoutLoading}
            disabled={checkoutLoading || quoteLoading || !quote}
            size="lg"
            className="w-full"
          >
            {!checkoutLoading &&
              (payMethod === "crypto" ? (
                <Bitcoin className="h-4 w-4" />
              ) : payMethod === "bank_transfer" ? (
                <Landmark className="h-4 w-4" />
              ) : (
                <CreditCard className="h-4 w-4" />
              ))}
            {checkoutLoading
              ? "Starting checkout..."
              : quote
                ? `Purchase · ${money(displayAmount, displayCurrency)}`
                : "Purchase"}
          </Button>

          {checkoutError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {checkoutError}
            </div>
          )}

          <p className="flex items-start gap-1.5 text-xs text-ink-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The total is recomputed and verified server-side before you are
            charged. Proxies are added to your account automatically once
            payment is confirmed.
          </p>
          <p className="flex items-start gap-1.5 text-xs text-ink-400">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Pricing reflects live upstream cost and live exchange rates, and may
            change between sessions.
          </p>
        </CardContent>
      </Card>

      {/* In-app add-on guide — overlays the billing page, never unmounts it. */}
      <AddonInfoPanel
        open={faqOpen}
        focusId={faqFocus}
        onClose={() => setFaqOpen(false)}
      />
    </>
  );
}

/** Sub-section heading with an info icon that opens the add-on guide. */
function AddonSectionHeading({
  title,
  desc,
  onInfo,
}: {
  title: string;
  desc: string;
  onInfo: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          {title}
        </p>
        <button
          type="button"
          onClick={onInfo}
          aria-label={`About ${title}`}
          className="text-ink-400 transition hover:text-brand-600"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-0.5 text-xs text-ink-500">{desc}</p>
    </div>
  );
}

/** A single selectable preset tile, with optional "Popular" badge. */
function OptionTile({
  label,
  active,
  popular,
  onClick,
}: {
  label: string;
  active: boolean;
  popular?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border px-2 py-2.5 text-center text-xs font-medium leading-tight transition ${
        active
          ? "border-brand-400 bg-brand-50/50 text-ink-900 ring-2 ring-brand-500/10"
          : "border-ink-200 text-ink-600 hover:border-ink-300"
      }`}
    >
      {popular && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
          Popular
        </span>
      )}
      {active && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}
      {label}
    </button>
  );
}

/** The compact green Save button used inside the custom editors. */
function SaveButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-9 shrink-0 rounded-xl px-4 text-sm font-semibold transition ${
        disabled
          ? "cursor-not-allowed bg-ink-100 text-ink-400"
          : "bg-brand-500 text-white hover:bg-brand-600"
      }`}
    >
      Save
    </button>
  );
}
