/** Shared TypeScript types for Oforson Proxies. */

export type AccountStatus = "active" | "suspended" | "pending_verification";

export type ProxyType = "static_residential" | "rotating_residential" | "datacenter";

export type BillingUnit = "proxy" | "bandwidth_gb";

export type Plan = "free" | "starter" | "pro" | "business" | "enterprise";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "expired";

export type TicketStatus = "open" | "pending" | "resolved" | "closed";

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  account_status: AccountStatus;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  bandwidth_gb: number;
  bandwidth_used_gb: number;
  current_period_start: string;
  current_period_end: string;
  proxy_type: ProxyType;
  /** Subscription expiration + 48-hour grace period lifecycle (migration 014). */
  past_due_at?: string | null;
  grace_period_ends_at?: string | null;
  expired_at?: string | null;
  past_due_email_sent_at?: string | null;
  expired_email_sent_at?: string | null;
  source_order_id?: string | null;
}

export interface ProxyOrder {
  id: string;
  user_id: string;
  proxy_type: ProxyType;
  quantity: number;
  total_amount: number;
  status: "pending" | "completed" | "failed" | "refunded";
  created_at: string;
}

/** Credential lifecycle state of an allocated proxy (migration 014). */
export type ProxySessionStatus = "active" | "suspended" | "released";

export interface ProxySession {
  id: string;
  user_id: string;
  proxy_type: ProxyType;
  country_code: string;
  ip_address: string;
  port: number;
  username: string;
  password: string;
  bandwidth_used: number;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
  /** Migration 014: package link + credential lifecycle. */
  subscription_id?: string | null;
  status?: ProxySessionStatus;
  suspended_at?: string | null;
  released_at?: string | null;
  /** Migration 016: Webshare-style list metadata + per-proxy bandwidth cap. */
  city?: string | null;
  last_checked_at?: string | null;
  bandwidth_limit_gb?: number;
}

export interface BandwidthUsage {
  id: string;
  user_id: string;
  bytes_used: number;
  proxy_type: ProxyType;
  recorded_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface PaymentHistory {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "failed" | "refunded";
  invoice_url: string | null;
  description: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  type: "info" | "success" | "warning" | "alert";
  created_at: string;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "incident";
  published_at: string;
  expires_at: string | null;
}

export interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  affected_user_id: string | null;
  action_type: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface ProxyConfigurationRule {
  id: string;
  product_type: ProxyType;
  display_label: string;
  margin_multiplier: number;
  webshare_proxy_subtype: string;
  webshare_subtype_shared: string;
  webshare_subtype_dedicated: string;
  webshare_type_shared: string;
  webshare_type_dedicated: string;
  supports_private: boolean;
  webshare_type_private: string | null;
  webshare_subtype_private: string | null;
  pricing_term: "monthly" | "yearly";
  standard_bandwidth_gb: number;
  webshare_query_defaults: Record<string, unknown>;
  supports_dedicated: boolean;
  supports_country_targeting: boolean;
  supports_unlimited_bandwidth: boolean;
  min_quantity: number;
  max_quantity: number;
  billing_unit: BillingUnit;
  bandwidth_pool_size: number;
  min_gb: number;
  max_gb: number;
  default_gb: number;
  last_wholesale_cost: number | null;
  last_quote_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Network exclusivity tier maps onto a Webshare proxy_type. */
export type Exclusivity = "shared" | "private" | "dedicated";

export interface CheckoutConfig {
  type: ProxyType;
  qty: number;
  gb: number;
  /** Back-compat mirror of `exclusivity === "dedicated"`. */
  dedicated: boolean;
  exclusivity: Exclusivity;
  country: string;
  unlimited: boolean;
  /** Chosen standard bandwidth tier in GB (proxy-billed products). */
  standardGb: number;
  /** Add-on: Manual Replacements proxy replacements included. */
  proxyReplacements: number;
  /**
   * Add-on: Recurring Replacements how often the whole proxy list is
   * automatically refreshed, in seconds. 0 means no recurring refresh.
   */
  automaticRefreshFrequency: number;
  /** Add-on: high-priority network upgrade. */
  highPriorityNetwork: boolean;
}

export interface PriceQuoteCharge {
  currency: string;
  amount: number;
  rate: number;
  bufferPct: number;
  source: string;
}

export interface PriceQuote {
  productType: ProxyType;
  displayLabel: string;
  billingUnit: BillingUnit;
  quantity: number;
  gb: number;
  dedicated: boolean;
  exclusivity?: Exclusivity;
  country: string;
  unlimitedBandwidth: boolean;
  /** Standard bandwidth tier in GB (0 when Unlimited). */
  standardGb?: number;
  term: string;
  retailPrice: number;
  currency: string;
  charge?: PriceQuoteCharge;
}
