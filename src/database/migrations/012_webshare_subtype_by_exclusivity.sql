-- =====================================================
-- 012_webshare_subtype_by_exclusivity.sql
-- Fix: Webshare proxy_subtype must vary with the exclusivity choice.
--
-- Webshare's pricing API (GET /api/v2/subscription/pricing/) only accepts
-- certain proxy_subtype values for each proxy_type:
--
--     proxy_type      valid proxy_subtype values
--     -----------     --------------------------------
--     shared          default, residential, isp
--     semidedicated   premium, isp
--     dedicated       premium, isp
--
-- The old schema stored a single `webshare_proxy_subtype` per product, so a
-- Datacenter quote sent proxy_subtype = "default" for BOTH the Shared and
-- the Dedicated exclusivity. "default" is not valid for proxy_type
-- "dedicated", so every Datacenter + Dedicated quote failed with:
--   HTTP 400 {"proxy_subtype":[{"message":"default is not a valid choice."}]}
--
-- Fix: store the subtype per exclusivity, mirroring webshare_type_shared /
-- webshare_type_dedicated. The legacy `webshare_proxy_subtype` column is
-- kept as a fallback and is no longer the source of truth.
--
-- Applied to project xuwqhjgovdwiokubnjjd as migration
-- "webshare_subtype_by_exclusivity".
-- Idempotent / safe to re-run.
-- =====================================================

-- ---- 1. New columns ----------------------------------------------------
alter table public.proxy_configuration_rules
  add column if not exists webshare_subtype_shared    text,
  add column if not exists webshare_subtype_dedicated text;

-- ---- 2. Backfill from the legacy single column -------------------------
-- Anything not explicitly corrected below inherits the old value.
update public.proxy_configuration_rules
   set webshare_subtype_shared = coalesce(webshare_subtype_shared, webshare_proxy_subtype)
 where webshare_subtype_shared is null;

update public.proxy_configuration_rules
   set webshare_subtype_dedicated = coalesce(webshare_subtype_dedicated, webshare_proxy_subtype)
 where webshare_subtype_dedicated is null;

-- ---- 3. Correct each product to Webshare's accepted combinations -------
-- Datacenter: shared pool = "default"; dedicated pool = "premium"
-- ("default" is rejected by proxy_type "dedicated").
update public.proxy_configuration_rules
   set webshare_subtype_shared    = 'default',
       webshare_subtype_dedicated = 'premium'
 where product_type = 'datacenter';

-- Static ISP: "isp" is valid for both shared and dedicated.
update public.proxy_configuration_rules
   set webshare_subtype_shared    = 'isp',
       webshare_subtype_dedicated = 'isp'
 where product_type = 'static_residential';

-- Rotating Residential: "residential" only exists under proxy_type "shared";
-- this product never offers a Dedicated exclusivity, but keep both columns
-- populated for NOT NULL safety.
update public.proxy_configuration_rules
   set webshare_subtype_shared    = 'residential',
       webshare_subtype_dedicated = 'residential'
 where product_type = 'rotating_residential';

-- ---- 4. Enforce NOT NULL now that every row is populated ---------------
alter table public.proxy_configuration_rules
  alter column webshare_subtype_shared    set not null,
  alter column webshare_subtype_dedicated set not null;

comment on column public.proxy_configuration_rules.webshare_subtype_shared is
  'Webshare proxy_subtype sent when the customer picks Shared exclusivity.';
comment on column public.proxy_configuration_rules.webshare_subtype_dedicated is
  'Webshare proxy_subtype sent when the customer picks Dedicated exclusivity.';
comment on column public.proxy_configuration_rules.webshare_proxy_subtype is
  'LEGACY single subtype. Superseded by webshare_subtype_shared / _dedicated; kept only as a fallback.';
