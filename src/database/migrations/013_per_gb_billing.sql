-- =====================================================
-- 013_per_gb_billing.sql
-- Per-GB billing for bandwidth-metered products.
--
-- Background
-- ----------
-- Webshare's pricing API rejects "unlimited bandwidth" on residential
-- proxy plans:
--   HTTP 400 {"bandwidth_limit":[{"message":
--             "Cannot select unlimited bandwidth with residential proxy plans."}]}
-- Rotating residential is genuinely bandwidth-metered — the customer buys
-- a number of GB, not a number of IPs. This migration teaches the pricing
-- engine the difference between the two billing models:
--
--   billing_unit = 'proxy'        -> customer picks an IP count   (datacenter, static ISP)
--   billing_unit = 'bandwidth_gb' -> customer picks a GB amount   (rotating residential)
--
-- For a 'bandwidth_gb' product the Webshare query sends the chosen GB as
-- `bandwidth_limit` (never 0 / "unlimited"), and a fixed pool of
-- `bandwidth_pool_size` gateway proxies. The order's `quantity` column
-- then stores that pool size (what actually gets provisioned), while the
-- purchased GB lives in the order metadata.
--
-- Applied to project xuwqhjgovdwiokubnjjd as migration "per_gb_billing".
-- Idempotent / safe to re-run.
-- =====================================================

-- ---- 1. New columns ----------------------------------------------------
alter table public.proxy_configuration_rules
  add column if not exists billing_unit text not null default 'proxy'
    check (billing_unit in ('proxy', 'bandwidth_gb')),

  -- Number of gateway proxies provisioned for a bandwidth_gb plan. The
  -- pool auto-rotates, so a small fixed pool serves any GB allowance.
  add column if not exists bandwidth_pool_size integer not null default 1
    check (bandwidth_pool_size >= 1),

  -- GB guardrails for a bandwidth_gb product (ignored by 'proxy' products).
  add column if not exists min_gb     integer not null default 1
    check (min_gb >= 1),
  add column if not exists max_gb     integer not null default 1000,
  add column if not exists default_gb integer not null default 50;

-- max_gb must not sit below min_gb (added separately so re-runs are safe).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'proxy_configuration_rules_gb_range_chk'
  ) then
    alter table public.proxy_configuration_rules
      add constraint proxy_configuration_rules_gb_range_chk
      check (max_gb >= min_gb);
  end if;
end $$;

comment on column public.proxy_configuration_rules.billing_unit is
  'How the customer buys this product: ''proxy'' = pick an IP count; ''bandwidth_gb'' = pick a GB amount.';
comment on column public.proxy_configuration_rules.bandwidth_pool_size is
  'Gateway proxies provisioned for a bandwidth_gb plan (stored as the order quantity).';
comment on column public.proxy_configuration_rules.min_gb is
  'Minimum purchasable GB for a bandwidth_gb product.';
comment on column public.proxy_configuration_rules.max_gb is
  'Maximum purchasable GB for a bandwidth_gb product.';
comment on column public.proxy_configuration_rules.default_gb is
  'Default GB pre-selected in the buying panel for a bandwidth_gb product.';

-- ---- 2. Rotating Residential -> per-GB billing -------------------------
-- Webshare rejects unlimited bandwidth for residential plans, so the
-- Unlimited upgrade is turned off and the product is billed by GB.
update public.proxy_configuration_rules
   set billing_unit                 = 'bandwidth_gb',
       supports_unlimited_bandwidth  = false,
       bandwidth_pool_size           = 1,
       min_gb                        = 1,
       max_gb                        = 1000,
       default_gb                    = 50,
       notes = 'Rotating residential pool, billed per GB of bandwidth. '
            || 'Retail = 1.3x Webshare wholesale. Unlimited bandwidth is not '
            || 'offered (Webshare rejects it for residential plans).',
       updated_at = now()
 where product_type = 'rotating_residential';

-- ---- 3. Datacenter + Static ISP stay proxy-count billed ----------------
-- Explicit for clarity / idempotency — these keep billing_unit = 'proxy'.
update public.proxy_configuration_rules
   set billing_unit = 'proxy',
       updated_at   = now()
 where product_type in ('datacenter', 'static_residential');
