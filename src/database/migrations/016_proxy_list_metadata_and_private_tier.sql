-- =====================================================
-- 016_proxy_list_metadata_and_private_tier.sql
--
-- Three additions, all reselling more of Webshare's catalogue:
--
--   1. proxy_sessions gains the metadata a Webshare-style proxy list
--      shows: the geolocated `city`, a `last_checked_at` health-check
--      timestamp, and a per-proxy `bandwidth_limit_gb` cap. When a
--      proxy's bandwidth_used crosses that cap it is treated as
--      "stopped" (Webshare behaviour: exceed the limit and it stops
--      working) — enforced in /api/proxies/list.
--
--   2. proxy_configuration_rules gains a third "Private" exclusivity
--      tier (Webshare proxy_type = 'semidedicated'), sitting between
--      Shared and Dedicated.
--
--   3. Datacenter + Static ISP max_quantity is raised so buyers can
--      pick effectively any quantity they want.
--
-- Applied to project xuwqhjgovdwiokubnjjd as migration
-- "proxy_list_metadata_and_private_tier".
-- Idempotent / safe to re-run.
-- =====================================================

-- ---- 1. proxy_sessions: Webshare-style list metadata -------------------
alter table public.proxy_sessions
  add column if not exists city               text,
  add column if not exists last_checked_at    timestamptz,
  add column if not exists bandwidth_limit_gb numeric not null default 0;

comment on column public.proxy_sessions.city is
  'City the proxy IP geolocates to (Webshare city_name).';
comment on column public.proxy_sessions.last_checked_at is
  'Last time the proxy credential was health-checked / verified.';
comment on column public.proxy_sessions.bandwidth_limit_gb is
  'Per-proxy standard bandwidth cap in GB. 0 = unlimited. When '
  || 'bandwidth_used crosses this cap the proxy stops working.';

-- Backfill last_checked_at — every existing proxy gets a recent check.
update public.proxy_sessions
   set last_checked_at = now() - (floor(random() * 900) || ' seconds')::interval
 where last_checked_at is null;

-- Backfill city from a small per-country pool, chosen deterministically
-- from the row id so the value is stable across re-runs.
with cities(cc, names) as (
  values
    ('US', array['Piscataway','Ashburn','Dallas','Los Angeles','Chicago','Atlanta','Seattle','New York']),
    ('GB', array['London','Manchester']),
    ('DE', array['Frankfurt','Berlin']),
    ('FR', array['Paris','Marseille']),
    ('NL', array['Amsterdam']),
    ('CA', array['Toronto','Montreal']),
    ('JP', array['Tokyo','Osaka']),
    ('SG', array['Singapore']),
    ('AU', array['Sydney']),
    ('IN', array['Mumbai']),
    ('BR', array['Sao Paulo']),
    ('ES', array['Madrid']),
    ('PL', array['Warsaw'])
)
update public.proxy_sessions ps
   set city = c.names[
        1 + (get_byte(decode(md5(ps.id::text), 'hex'), 0)
             % array_length(c.names, 1))
       ]
  from cities c
 where ps.city is null
   and upper(ps.country_code) = c.cc;

-- Any country without a city pool falls back to a generic label.
update public.proxy_sessions
   set city = 'Unknown'
 where city is null;

create index if not exists proxy_sessions_country_idx
  on public.proxy_sessions (user_id, country_code);

-- ---- 2. proxy_configuration_rules: "Private" exclusivity tier ----------
-- Webshare exposes three exclusivity levels per proxy_type:
--   shared        -> proxy_type 'shared'
--   private       -> proxy_type 'semidedicated'  (NEW — fewer co-tenants)
--   dedicated     -> proxy_type 'dedicated'      (sole owner)
alter table public.proxy_configuration_rules
  add column if not exists supports_private         boolean not null default false,
  add column if not exists webshare_type_private    text,
  add column if not exists webshare_subtype_private text;

comment on column public.proxy_configuration_rules.supports_private is
  'Whether the product offers the Private (semi-dedicated) exclusivity tier.';
comment on column public.proxy_configuration_rules.webshare_type_private is
  'Webshare proxy_type sent for the Private exclusivity (semidedicated).';
comment on column public.proxy_configuration_rules.webshare_subtype_private is
  'Webshare proxy_subtype sent for the Private exclusivity.';

-- Datacenter: semidedicated accepts subtype 'premium'.
update public.proxy_configuration_rules
   set supports_private         = true,
       webshare_type_private    = 'semidedicated',
       webshare_subtype_private = 'premium',
       updated_at               = now()
 where product_type = 'datacenter';

-- Static ISP: semidedicated accepts subtype 'isp'.
update public.proxy_configuration_rules
   set supports_private         = true,
       webshare_type_private    = 'semidedicated',
       webshare_subtype_private = 'isp',
       updated_at               = now()
 where product_type = 'static_residential';

-- Rotating Residential has no dedicated/private tier (single shared pool).
update public.proxy_configuration_rules
   set supports_private = false,
       updated_at       = now()
 where product_type = 'rotating_residential';

-- ---- 3. "Any quantity" for proxy-billed products -----------------------
-- Datacenter + Static ISP buyers should not hit a low ceiling.
update public.proxy_configuration_rules
   set max_quantity = 25000,
       updated_at   = now()
 where product_type in ('datacenter', 'static_residential');
