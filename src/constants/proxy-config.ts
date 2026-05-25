import type { BillingUnit, ProxyType } from "@/types";

export interface ProductOption {
  id: ProxyType;
  name: string;
  tagline: string;
  billingUnit: BillingUnit;
  supportsDedicated: boolean;
  supportsPrivate: boolean;
  supportsCountryTargeting: boolean;
  supportsUnlimitedBandwidth: boolean;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  minGb: number;
  maxGb: number;
  defaultGb: number;
  bandwidthPoolSize: number;
}

/**
 * Standard bandwidth tiers offered for proxy-billed products, mirroring
 * Webshare's subscription page. A proxy that exceeds its tier stops working
 * until the plan renews. Keep in sync with src/lib/pricing/calculator.ts.
 */
export const STANDARD_BANDWIDTH_TIERS = [250, 1000, 5000] as const;

/* ------------------------------------------------------------------ *
 * Replacement add-on options
 *
 * The "Replacement" add-on bundles two Webshare features:
 *   • Recurring Replacements — the whole proxy list auto-refreshes on a
 *     schedule. Stored as a frequency in seconds (0 = off).
 *   • Manual Replacements — a pool of one-off swaps the customer can
 *     trigger themselves. Stored as a count of IPs.
 * ------------------------------------------------------------------ */

export interface RecurringPreset {
  label: string;
  /** Frequency in seconds. 0 = no recurring refresh. */
  seconds: number;
  popular?: boolean;
}

/** Recurring Replacement frequency presets, mirroring Webshare. */
export const RECURRING_REPLACEMENT_PRESETS: RecurringPreset[] = [
  { label: "No Refreshes", seconds: 0 },
  { label: "Monthly", seconds: 2_592_000, popular: true },
  { label: "Weekly", seconds: 604_800 },
  { label: "Daily", seconds: 86_400 },
  { label: "Every 4 hours", seconds: 14_400 },
  { label: "Every 1 hour", seconds: 3_600 },
  { label: "Every 15 minutes", seconds: 900 },
];

export interface RecurringUnit {
  label: string;
  /** Seconds in one unit. */
  seconds: number;
}

/** Units offered when entering a custom Recurring Replacement frequency. */
export const RECURRING_CUSTOM_UNITS: RecurringUnit[] = [
  { label: "month", seconds: 2_592_000 },
  { label: "week", seconds: 604_800 },
  { label: "hour", seconds: 3_600 },
  { label: "minute", seconds: 60 },
];

/** Manual Replacement count presets, mirroring Webshare. */
export const MANUAL_REPLACEMENT_PRESETS: { count: number; popular?: boolean }[] = [
  { count: 10 },
  { count: 50, popular: true },
  { count: 100 },
  { count: 250 },
  { count: 500 },
  { count: 1000 },
  { count: 2500 },
  { count: 5000 },
];

/** Hard cap on a custom Manual Replacement count. */
export const MANUAL_REPLACEMENT_MAX = 5000;

export const PRODUCT_OPTIONS: ProductOption[] = [
  {
    id: "datacenter",
    name: "Datacenter",
    tagline: "High-speed dedicated IPs",
    billingUnit: "proxy",
    supportsDedicated: true,
    supportsPrivate: true,
    supportsCountryTargeting: true,
    supportsUnlimitedBandwidth: true,
    minQuantity: 1,
    maxQuantity: 25000,
    defaultQuantity: 100,
    minGb: 1,
    maxGb: 1000,
    defaultGb: 50,
    bandwidthPoolSize: 1,
  },
  {
    id: "static_residential",
    name: "Static ISP",
    tagline: "ISP-grade IPs that stay yours",
    billingUnit: "proxy",
    supportsDedicated: true,
    supportsPrivate: true,
    supportsCountryTargeting: true,
    supportsUnlimitedBandwidth: true,
    minQuantity: 1,
    maxQuantity: 25000,
    defaultQuantity: 50,
    minGb: 1,
    maxGb: 1000,
    defaultGb: 50,
    bandwidthPoolSize: 1,
  },
  {
    id: "rotating_residential",
    name: "Rotating Residential",
    tagline: "Auto-rotating residential pool",
    billingUnit: "bandwidth_gb",
    supportsDedicated: false,
    supportsPrivate: false,
    supportsCountryTargeting: true,
    supportsUnlimitedBandwidth: false,
    minQuantity: 1,
    maxQuantity: 100,
    defaultQuantity: 10,
    minGb: 1,
    maxGb: 1000,
    defaultGb: 50,
    bandwidthPoolSize: 1,
  },
];

export const WORLDWIDE = "WW";
