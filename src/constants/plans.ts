/**
 * Marketing product cards shown in the landing-page / pricing-page grid.
 *
 * NOTE ON PRICING: each card advertises a concrete starting price for the
 * smallest order. Orders are still priced live in the dashboard billing
 * panel (real upstream Webshare cost + margin) and volume discounts lower
 * the per-unit rate as the order grows — so the price shown here is the
 * entry point, not a ceiling. (Datacenter 2.0x, Static ISP 1.5x, Rotating
 * Residential 1.3x — see proxy_configuration_rules / pricing calculator.)
 */

/** A product card shown in the marketing pricing grid. */
export interface ProductPlan {
  id: string;
  name: string;
  tagline: string;
  /** Entry configuration line, e.g. "From 10 datacenter proxies". */
  entry?: string;
  /** Concrete starting price, e.g. "$0.20". Omitted for the Platform card. */
  price?: string;
  /** Unit shown next to the price, e.g. "/proxy" or "/GB". */
  priceUnit?: string;
  /** Headline shown when there is no concrete price (e.g. Platform). */
  priceNote?: string;
  /** Small print under the price. */
  priceSub: string;
  recommended?: boolean;
  features: string[];
  cta: string;
  href: string;
}

export const PRICING_PLANS: ProductPlan[] = [
  {
    id: "datacenter",
    name: "Datacenter",
    tagline: "High-speed datacenter IPs",
    entry: "From 10 datacenter proxies",
    price: "$0.20",
    priceUnit: "/proxy",
    priceSub: "250 GB bandwidth per proxy",
    recommended: true,
    features: [
      "Shared, private or dedicated IPs",
      "Country & city targeting",
      "250 GB to unlimited bandwidth tiers",
      "Recurring Replacements — scheduled auto-refresh",
      "Manual Replacements — on-demand IP swaps",
      "High-priority network add-on",
      "Volume pricing — buy more, pay less per proxy",
    ],
    cta: "Configure datacenter",
    href: "/signup",
  },
  {
    id: "static_isp",
    name: "Static ISP",
    tagline: "ISP-grade residential IPs that stay yours",
    entry: "From 10 ISP proxies",
    price: "$0.45",
    priceUnit: "/proxy",
    priceSub: "250 GB bandwidth per proxy",
    features: [
      "Shared, private or dedicated IPs",
      "Sticky, long-lived sessions",
      "Country & city targeting",
      "250 GB to unlimited bandwidth tiers",
      "Recurring & Manual Replacements",
      "High-priority network add-on",
      "Volume pricing — buy more, pay less per proxy",
    ],
    cta: "Configure ISP proxies",
    href: "/signup",
  },
  {
    id: "rotating_residential",
    name: "Rotating Residential",
    tagline: "Auto-rotating residential pool, billed by GB",
    price: "$3.58",
    priceUnit: "/GB",
    priceSub: "Pay only for the bandwidth you use",
    features: [
      "Automatic IP rotation",
      "Sticky session pinning",
      "Country targeting",
      "Metered per GB — no wasted spend",
      "Volume pricing — more GB, lower per-GB rate",
    ],
    cta: "Configure residential",
    href: "/signup",
  },
  {
    id: "platform",
    name: "Platform",
    tagline: "Included with every account",
    entry: "Free with every plan",
    priceNote: "Always included",
    priceSub: "No extra cost on any product",
    features: [
      "Self-serve dashboard with live analytics",
      "Guided proxy integration & code snippets",
      "Session manager & usage tracking",
      "Crypto, card & bank-transfer checkout",
      "Programmatic API access",
      "Email support",
    ],
    cta: "Create free account",
    href: "/signup",
  },
];

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "IN", name: "India" },
  { code: "SG", name: "Singapore" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" }
];
