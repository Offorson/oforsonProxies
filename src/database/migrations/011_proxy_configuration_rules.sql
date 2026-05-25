-- =====================================================
-- 011_proxy_configuration_rules.sql
-- Webshare checkout-customization pricing engine.
--
-- Houses our structural product margin multipliers + the mapping used
-- to query Webshare's live pricing endpoint
-- (GET /api/v2/subscription/pricing/) for the wholesale cost.
--
-- Applied to project xuwqhjgovdwiokubnjjd as migration
-- "proxy_configuration_rules".
-- Idempotent / safe to re-run.
-- =====================================================

-- Shared updated_at helper (idempotent). search_path is pinned empty so the
-- function cannot be hijacked via a mutable search_path (Supabase lint 0011).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.proxy_configuration_rules (
  id                            uuid primary key default extensions.uuid_generate_v4(),
  product_type                  proxy_type not null unique,
  display_label                 text not null,

  -- Our structural profit margin:  retail = wholesale * margin_multiplier
  margin_multiplier             numeric(6,3) not null check (margin_multiplier >= 1.0),

  -- Mapping into Webshare GET /api/v2/subscription/pricing/ query params.
  webshare_proxy_subtype        text not null,                       -- default | isp | residential ...
  webshare_type_shared          text not null default 'shared',      -- proxy_type when Shared exclusivity
  webshare_type_dedicated       text not null default 'dedicated',   -- proxy_type when Dedicated exclusivity
  pricing_term                  text not null default 'monthly'
                                  check (pricing_term in ('monthly','yearly')),
  standard_bandwidth_gb         integer not null default 250
                                  check (standard_bandwidth_gb >= 0),  -- 0 == unlimited
  webshare_query_defaults       jsonb not null default '{}'::jsonb,    -- extra static query overrides

  -- Which checkout-customization controls are offered for this product.
  supports_dedicated            boolean not null default true,
  supports_country_targeting    boolean not null default true,
  supports_unlimited_bandwidth  boolean not null default true,

  -- Quantity guardrails.
  min_quantity                  integer not null default 1 check (min_quantity >= 1),
  max_quantity                  integer not null default 500 check (max_quantity >= min_quantity),

  -- Last successful live wholesale snapshot (observability only — never a pricing fallback).
  last_wholesale_cost           numeric(12,4),
  last_quote_at                 timestamptz,

  is_active                     boolean not null default true,
  notes                         text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

comment on table public.proxy_configuration_rules is
  'Pricing engine: per-product margin multipliers + Webshare /subscription/pricing query mapping. Margins are confidential — readable only by the service role / admins.';
comment on column public.proxy_configuration_rules.margin_multiplier is
  'Structural markup applied to the live Webshare wholesale cost (retail = wholesale * multiplier).';
comment on column public.proxy_configuration_rules.standard_bandwidth_gb is
  'GB sent as bandwidth_limit when the customer keeps the Standard limit; the Unlimited upgrade sends 0.';

drop trigger if exists trg_proxy_configuration_rules_updated_at on public.proxy_configuration_rules;
create trigger trg_proxy_configuration_rules_updated_at
  before update on public.proxy_configuration_rules
  for each row execute function public.set_updated_at();

-- ---- Row Level Security ------------------------------------------------
-- Margin multipliers are commercially sensitive. There is deliberately NO
-- policy for ordinary users, so only the service role (edge functions /
-- server routes) can read costs. Admins may read + manage.
alter table public.proxy_configuration_rules enable row level security;

drop policy if exists "admins manage proxy configuration rules"
  on public.proxy_configuration_rules;
create policy "admins manage proxy configuration rules"
  on public.proxy_configuration_rules
  for all
  to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_admin = true));

-- ---- Seed: the three structural product multipliers --------------------
insert into public.proxy_configuration_rules
  (product_type, display_label, margin_multiplier,
   webshare_proxy_subtype, webshare_type_shared, webshare_type_dedicated,
   pricing_term, standard_bandwidth_gb,
   supports_dedicated, supports_country_targeting, supports_unlimited_bandwidth,
   min_quantity, max_quantity, notes)
values
  ('datacenter', 'Datacenter', 2.000,
   'default', 'shared', 'dedicated',
   'monthly', 250,
   true, true, true,
   1, 500, 'Datacenter IPs priced per proxy. Retail = 2.0x Webshare wholesale.'),

  ('static_residential', 'Static ISP', 1.500,
   'isp', 'shared', 'dedicated',
   'monthly', 250,
   true, true, true,
   1, 500, 'Static ISP IPs priced per proxy. Retail = 1.5x Webshare wholesale.'),

  ('rotating_residential', 'Rotating Residential', 1.300,
   'residential', 'shared', 'shared',
   'monthly', 250,
   false, true, true,
   1, 100, 'Rotating residential pool. Retail = 1.3x Webshare wholesale. Dedicated exclusivity n/a.')
on conflict (product_type) do update set
  display_label                 = excluded.display_label,
  margin_multiplier             = excluded.margin_multiplier,
  webshare_proxy_subtype        = excluded.webshare_proxy_subtype,
  webshare_type_shared          = excluded.webshare_type_shared,
  webshare_type_dedicated       = excluded.webshare_type_dedicated,
  pricing_term                  = excluded.pricing_term,
  standard_bandwidth_gb         = excluded.standard_bandwidth_gb,
  supports_dedicated            = excluded.supports_dedicated,
  supports_country_targeting    = excluded.supports_country_targeting,
  supports_unlimited_bandwidth  = excluded.supports_unlimited_bandwidth,
  min_quantity                  = excluded.min_quantity,
  max_quantity                  = excluded.max_quantity,
  notes                         = excluded.notes,
  updated_at                    = now();
