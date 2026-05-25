-- =====================================================
-- 014_subscription_lifecycle.sql
-- Subscription expiration + 48-hour grace period lifecycle.
--
-- Mirrors Webshare's backend behaviour: a failed renewal or a lapsed
-- plan does NOT delete the customer's records. Instead the package is
-- parked in 'past_due', its proxy credentials are suspended, and the
-- customer's exact IPs are held for a strict 48-hour grace window. If
-- they settle the invoice inside the window the original proxies snap
-- back online; if the window closes the worker hard-drops the package
-- to 'expired' and releases the IPs back to the global pool.
--
-- "Package" == a row in public.subscriptions (the only table whose
-- status enum carries 'past_due' / 'expired').
--
-- This migration is the engine. It is intentionally trigger-driven:
-- ANY code path that sets subscriptions.status = 'past_due' (billing
-- webhook, QA simulator, the cron worker) automatically gets proxy
-- suspension + customer notification + transactional-email dispatch.
--
--   1. Lifecycle columns on subscriptions + proxy_sessions.
--   2. Proxy credential routines (suspend / reactivate / release).
--   3. subscriptions status triggers  -> the moment-of-change hooks.
--   4. order -> subscription -> proxy_sessions linkage triggers.
--   5. run_subscription_lifecycle_sweep() -> the background worker body.
--   6. pg_cron schedule for the worker.
--   7. Reconciliation of pre-existing data.
--
-- Idempotent / safe to re-run.
-- Applied to project xuwqhjgovdwiokubnjjd as migration
-- "subscription_lifecycle".
-- =====================================================

-- ---- 0. Extensions + schema -------------------------------------------
-- pg_net lets a trigger fire an async HTTP POST to our edge function so
-- the transactional email is sent "the moment" status flips. If pg_net
-- cannot be enabled the status changes still apply (email just no-ops).
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise warning '[014] pg_net not enabled (email dispatch will no-op): %', sqlerrm;
end $$;

create schema if not exists private;

-- ---- 1. subscriptions: lifecycle columns ------------------------------
alter table public.subscriptions
  add column if not exists past_due_at            timestamptz,
  add column if not exists grace_period_ends_at   timestamptz,
  add column if not exists expired_at             timestamptz,
  add column if not exists past_due_email_sent_at timestamptz,
  add column if not exists expired_email_sent_at  timestamptz,
  add column if not exists source_order_id        uuid
    references public.proxy_orders(id) on delete set null;

comment on column public.subscriptions.past_due_at is
  'When the package entered past_due (failed renewal / lapsed plan).';
comment on column public.subscriptions.grace_period_ends_at is
  'Hard deadline = past_due_at + 48h. After this the worker expires the package.';
comment on column public.subscriptions.expired_at is
  'When the package was hard-dropped to expired and its proxies released.';
comment on column public.subscriptions.past_due_email_sent_at is
  'Set by the edge function once the grace-period email is delivered (idempotency guard).';
comment on column public.subscriptions.expired_email_sent_at is
  'Set by the edge function once the final hard-drop email is delivered (idempotency guard).';
comment on column public.subscriptions.source_order_id is
  'The proxy_orders row this package was provisioned from (set automatically by trigger).';

-- ---- 2. proxy_sessions: credential lifecycle columns ------------------
alter table public.proxy_sessions
  add column if not exists subscription_id uuid
    references public.subscriptions(id) on delete set null,
  add column if not exists status       text not null default 'active',
  add column if not exists suspended_at timestamptz,
  add column if not exists released_at  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'proxy_sessions_status_chk') then
    alter table public.proxy_sessions
      add constraint proxy_sessions_status_chk
      check (status in ('active','suspended','released'));
  end if;
end $$;

comment on column public.proxy_sessions.subscription_id is
  'The package (subscription) that owns this proxy credential.';
comment on column public.proxy_sessions.status is
  'active = usable; suspended = traffic blocked during the 48h grace window (credentials retained); released = credentials wiped, IP returned to the global pool.';
comment on column public.proxy_sessions.suspended_at is
  'When the credential was suspended because its package went past_due.';
comment on column public.proxy_sessions.released_at is
  'When the credential was wiped because its package expired.';

-- ---- 3. Indexes -------------------------------------------------------
create index if not exists subscriptions_lifecycle_idx
  on public.subscriptions (status, current_period_end);
create index if not exists subscriptions_grace_idx
  on public.subscriptions (status, grace_period_ends_at);
create index if not exists proxy_sessions_subscription_idx
  on public.proxy_sessions (subscription_id);
create index if not exists proxy_sessions_status_idx
  on public.proxy_sessions (status);

-- ---- 4. private.app_config -------------------------------------------
-- Server-only key/value store. Holds the subscription-lifecycle edge
-- function URL + shared secret used to dispatch transactional email.
-- Left EMPTY by this migration: email dispatch stays dormant until the
-- edge function is deployed and these two rows are inserted (see the
-- "ENABLING EMAIL DISPATCH" block at the bottom of this file). Until
-- then every status change still applies; only the email is skipped.
create table if not exists private.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
comment on table private.app_config is
  'Server-only config. Keys: lifecycle_function_url, lifecycle_shared_secret.';

-- =====================================================
-- 5. PROXY CREDENTIAL ROUTINES
-- All SECURITY DEFINER with an empty search_path (Supabase lint 0011);
-- every object reference below is therefore fully schema-qualified.
-- Kept in the private schema so they are NOT exposed over PostgREST.
-- =====================================================

-- Suspend every usable credential on a package: blocks traffic but
-- KEEPS the IP / username / password so the exact same proxies can be
-- snapped back on payment. This is the "temporarily revoke auth" step.
create or replace function private.suspend_subscription_proxies(p_subscription_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.proxy_sessions
     set status       = 'suspended',
         is_active    = false,
         suspended_at = now()
   where subscription_id = p_subscription_id
     and status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Reactivate suspended credentials when the invoice is settled inside
-- the 48h window — the customer gets their exact same proxies back.
create or replace function private.reactivate_subscription_proxies(p_subscription_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.proxy_sessions
     set status       = 'active',
         is_active    = true,
         suspended_at = null
   where subscription_id = p_subscription_id
     and status = 'suspended';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Hard release: wipe the allocated proxy configuration strings so the
-- system stays clean and the IP goes back to the global pool. The row
-- is kept (status = 'released') for billing history, but it carries no
-- usable credentials and is filtered out of active dashboard views.
create or replace function private.release_subscription_proxies(p_subscription_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.proxy_sessions
     set status      = 'released',
         is_active   = false,
         released_at = now(),
         ended_at    = coalesce(ended_at, now()),
         ip_address  = null,
         port        = null,
         username    = null,
         password    = null
   where subscription_id = p_subscription_id
     and status in ('active','suspended');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =====================================================
-- 6. TRANSACTIONAL-EMAIL DISPATCH
-- Fires an async HTTP POST (via pg_net) to the subscription-lifecycle
-- edge function, which calls Resend. Dormant until private.app_config
-- is populated. Wrapped so a dispatch failure can NEVER block or roll
-- back the status change that triggered it.
-- =====================================================
create or replace function private.dispatch_lifecycle_email(
  p_subscription_id uuid,
  p_event           text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from private.app_config where key = 'lifecycle_function_url';
  select value into v_secret from private.app_config where key = 'lifecycle_shared_secret';

  if v_url is null or length(trim(v_url)) = 0 then
    return;  -- email dispatch not configured yet
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('event', p_event, 'subscription_id', p_subscription_id),
    headers := jsonb_build_object(
                 'Content-Type',      'application/json',
                 'x-lifecycle-secret', coalesce(v_secret, '')
               )
  );
exception when others then
  raise warning '[014] dispatch_lifecycle_email(%, %) failed: %',
    p_subscription_id, p_event, sqlerrm;
end;
$$;

-- =====================================================
-- 7. SUBSCRIPTION STATUS TRIGGERS  — the moment-of-change hooks
-- =====================================================

-- BEFORE UPDATE: stamp the lifecycle timestamps so the row is always
-- internally consistent, regardless of which caller flipped status.
create or replace function private.subscription_lifecycle_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Entering past_due: open a fresh strict 48h grace window.
  if new.status = 'past_due' and old.status is distinct from 'past_due' then
    new.past_due_at            := coalesce(new.past_due_at, now());
    new.grace_period_ends_at   := coalesce(new.grace_period_ends_at, now() + interval '48 hours');
    new.past_due_email_sent_at := null;
  end if;

  -- Entering expired.
  if new.status = 'expired' and old.status is distinct from 'expired' then
    new.expired_at            := coalesce(new.expired_at, now());
    new.expired_email_sent_at := null;
  end if;

  -- Recovering out of past_due (invoice settled inside the window):
  -- clear the grace markers so the package looks healthy again.
  if old.status = 'past_due' and new.status in ('active','trialing') then
    new.past_due_at            := null;
    new.grace_period_ends_at   := null;
    new.past_due_email_sent_at := null;
  end if;

  return new;
end;
$$;

-- AFTER UPDATE: run the side effects — suspend / reactivate / release
-- proxy credentials, notify the customer in-app, and dispatch email.
create or replace function private.subscription_lifecycle_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- ---- Package just went PAST DUE -----------------------------------
  if new.status = 'past_due' and old.status is distinct from 'past_due' then
    perform private.suspend_subscription_proxies(new.id);

    insert into public.notifications (user_id, title, body, type)
    values (
      new.user_id,
      'Proxies paused — action needed',
      'Your proxy plan renewal did not go through, so we have paused your '
      || 'traffic. We are holding your exact IP addresses until '
      || coalesce(to_char(new.grace_period_ends_at, 'Mon DD, HH24:MI" UTC"'), 'the grace deadline')
      || '. Settle your invoice on the billing page within 48 hours and the '
      || 'same proxies reactivate instantly.',
      'warning'
    );

    perform private.dispatch_lifecycle_email(new.id, 'past_due');

  -- ---- Package just EXPIRED (48h window closed) ---------------------
  elsif new.status = 'expired' and old.status is distinct from 'expired' then
    perform private.release_subscription_proxies(new.id);

    insert into public.notifications (user_id, title, body, type)
    values (
      new.user_id,
      'Proxy allocation released',
      'Your 48-hour grace period has ended. Your custom proxy allocation '
      || 'has been released back to the global pool and access is now '
      || 'closed. You can purchase a new plan any time to get back online.',
      'alert'
    );

    perform private.dispatch_lifecycle_email(new.id, 'expired');

  -- ---- Package RECOVERED (invoice settled inside the window) --------
  elsif old.status = 'past_due' and new.status in ('active','trialing') then
    perform private.reactivate_subscription_proxies(new.id);

    insert into public.notifications (user_id, title, body, type)
    values (
      new.user_id,
      'Proxies reactivated',
      'Payment received — your subscription is active again and your '
      || 'original proxies are back online. Thanks for staying with us!',
      'success'
    );
  end if;

  return null;
end;
$$;

drop trigger if exists subscriptions_lifecycle_before on public.subscriptions;
create trigger subscriptions_lifecycle_before
  before update of status on public.subscriptions
  for each row
  when (old.status is distinct from new.status)
  execute function private.subscription_lifecycle_before();

drop trigger if exists subscriptions_lifecycle_after on public.subscriptions;
create trigger subscriptions_lifecycle_after
  after update of status on public.subscriptions
  for each row
  when (old.status is distinct from new.status)
  execute function private.subscription_lifecycle_after();

-- =====================================================
-- 8. ORDER -> SUBSCRIPTION -> PROXY_SESSIONS LINKAGE
-- A paid order becomes a "package"; the proxies provisioned by the
-- billing webhook are auto-linked to it. This is what lets the
-- lifecycle suspend/release ONLY the affected package's proxies and
-- leave a customer's other active packages untouched.
-- =====================================================

-- When a billing webhook flips an order to 'completed', materialise a
-- subscription row for it (once). Fires only on the status transition,
-- so directly-seeded QA orders are not affected.
create or replace function private.create_subscription_for_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gb numeric;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if not exists (
      select 1 from public.subscriptions where source_order_id = new.id
    ) then
      v_gb := coalesce(
                nullif(new.metadata -> 'config' ->> 'gb', '')::numeric,
                0
              );
      insert into public.subscriptions (
        user_id, plan, status, bandwidth_gb, bandwidth_used_gb, proxy_type,
        current_period_start, current_period_end, source_order_id
      )
      values (
        new.user_id,
        coalesce(nullif(new.metadata ->> 'plan', ''), new.proxy_type::text),
        'active',
        v_gb,
        0,
        new.proxy_type,
        now(),
        now() + interval '30 days',
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proxy_orders_create_subscription on public.proxy_orders;
create trigger proxy_orders_create_subscription
  after update of status on public.proxy_orders
  for each row
  execute function private.create_subscription_for_order();

-- Every proxy_sessions row gets stamped with the package it belongs to:
-- the owner's most recent live subscription. The billing webhook marks
-- the order completed (creating the subscription) before it inserts the
-- sessions, so the freshly-created package is picked up here.
create or replace function private.link_session_to_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.subscription_id is null then
    select s.id
      into new.subscription_id
      from public.subscriptions s
     where s.user_id = new.user_id
       and s.status in ('active','trialing','past_due')
     order by s.created_at desc
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists proxy_sessions_link_subscription on public.proxy_sessions;
create trigger proxy_sessions_link_subscription
  before insert on public.proxy_sessions
  for each row
  execute function private.link_session_to_subscription();

-- =====================================================
-- 9. BACKGROUND EXPIRATION WORKER
-- One pure-SQL sweep. Every status UPDATE below fires the triggers in
-- section 7, so suspension / release / notification / email all happen
-- automatically. Returns a JSON summary for observability.
-- =====================================================
create or replace function public.run_subscription_lifecycle_sweep()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lapsed  integer;
  v_expired integer;
begin
  -- (a) Active / trialing packages whose paid period has ended -> past_due.
  --     Covers a plain plan expiry where no billing webhook ever fired.
  with moved as (
    update public.subscriptions
       set status = 'past_due'
     where status in ('active','trialing')
       and current_period_end <= now()
    returning id
  )
  select count(*) into v_lapsed from moved;

  -- (b) past_due packages whose strict 48h window has closed -> expired.
  with moved as (
    update public.subscriptions
       set status = 'expired'
     where status = 'past_due'
       and grace_period_ends_at is not null
       and grace_period_ends_at <= now()
    returning id
  )
  select count(*) into v_expired from moved;

  return jsonb_build_object(
    'swept_at',          now(),
    'moved_to_past_due', v_lapsed,
    'moved_to_expired',  v_expired
  );
end;
$$;

comment on function public.run_subscription_lifecycle_sweep() is
  'Background worker body: lapsed packages -> past_due, past_due > 48h -> expired. Run by pg_cron; also callable by the edge function.';

-- Worker entrypoint is service-role only — never exposed to end users.
revoke all on function public.run_subscription_lifecycle_sweep() from public;
do $$
begin
  execute 'revoke all on function public.run_subscription_lifecycle_sweep() from anon, authenticated';
exception when others then null;
end $$;
grant execute on function public.run_subscription_lifecycle_sweep() to service_role;

-- =====================================================
-- 10. RECONCILE PRE-EXISTING DATA
-- =====================================================

-- Link legacy proxy_sessions (provisioned before this migration) to
-- their owner's most recent package.
update public.proxy_sessions ps
   set subscription_id = (
     select s.id
       from public.subscriptions s
      where s.user_id = ps.user_id
      order by s.created_at desc
      limit 1
   )
 where ps.subscription_id is null
   and exists (
     select 1 from public.subscriptions s2 where s2.user_id = ps.user_id
   );

-- Bring packages already sitting in past_due / expired into a state
-- consistent with the new invariants (fresh 48h window for past_due;
-- credentials suspended for past_due / released for expired).
do $$
declare
  r record;
begin
  for r in select id from public.subscriptions where status = 'past_due' loop
    update public.subscriptions
       set past_due_at          = coalesce(past_due_at, now()),
           grace_period_ends_at = coalesce(grace_period_ends_at, now() + interval '48 hours')
     where id = r.id;
    perform private.suspend_subscription_proxies(r.id);
  end loop;

  for r in select id from public.subscriptions where status = 'expired' loop
    perform private.release_subscription_proxies(r.id);
  end loop;
end $$;

-- =====================================================
-- 11. SCHEDULE THE BACKGROUND WORKER (pg_cron)
-- Runs hourly — well inside the 48h resolution we need. Adjust the cron
-- expression to taste; '*/15 * * * *' would check every 15 minutes.
-- =====================================================
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'oforson-subscription-lifecycle',
    '0 * * * *',
    'select public.run_subscription_lifecycle_sweep();'
  );
  raise notice '[014] pg_cron job "oforson-subscription-lifecycle" scheduled (hourly).';
exception when others then
  raise warning '[014] pg_cron not scheduled — enable the pg_cron extension, then run: '
    'select cron.schedule(''oforson-subscription-lifecycle'', ''0 * * * *'', '
    '''select public.run_subscription_lifecycle_sweep();''); (%).', sqlerrm;
end $$;

-- =====================================================
-- ENABLING EMAIL DISPATCH  (run AFTER deploying the edge function)
-- -----------------------------------------------------
-- The subscription-lifecycle edge function sends the grace-period and
-- hard-drop emails via Resend. Once it is deployed (verify_jwt = false)
-- and its RESEND_API_KEY + LIFECYCLE_SHARED_SECRET secrets are set,
-- activate dispatch by pointing app_config at it:
--
--   insert into private.app_config (key, value) values
--     ('lifecycle_function_url',
--      'https://xuwqhjgovdwiokubnjjd.supabase.co/functions/v1/subscription-lifecycle'),
--     ('lifecycle_shared_secret', '<the same value as LIFECYCLE_SHARED_SECRET>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- To pause dispatch again, simply: delete from private.app_config;
-- =====================================================
