-- ================================================================
-- OforsonProxies — COMPLETE DATABASE SETUP
-- Paste this ENTIRE file into Supabase → SQL Editor → Run
-- Safe to run multiple times.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ────────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type account_status as enum ('active', 'suspended', 'pending_verification');
  end if;
  if not exists (select 1 from pg_type where typname = 'proxy_type') then
    create type proxy_type as enum ('static_residential', 'rotating_residential', 'datacenter');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending', 'completed', 'failed', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type ticket_status as enum ('open', 'pending', 'resolved', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_priority') then
    create type ticket_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;
end $$;


-- ────────────────────────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  username      text unique,
  avatar_url    text,
  is_admin      boolean not null default false,
  account_status account_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.subscriptions (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  plan                  text not null default 'free',
  status                subscription_status not null default 'active',
  bandwidth_gb          numeric not null default 1,
  bandwidth_used_gb     numeric not null default 0,
  proxy_type            proxy_type not null default 'rotating_residential',
  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz not null default now() + interval '30 days',
  stripe_subscription_id text,
  created_at            timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

create table if not exists public.proxy_orders (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  proxy_type   proxy_type not null,
  quantity     integer not null default 1,
  total_amount numeric not null default 0,
  status       order_status not null default 'pending',
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists proxy_orders_user_idx on public.proxy_orders (user_id);

create table if not exists public.proxy_sessions (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  proxy_type     proxy_type not null,
  country_code   text not null,
  ip_address     inet,
  port           integer,
  username       text,
  password       text,
  bandwidth_used bigint not null default 0,
  is_active      boolean not null default true,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz
);
create index if not exists proxy_sessions_user_idx on public.proxy_sessions (user_id);
create index if not exists proxy_sessions_active_idx on public.proxy_sessions (user_id, is_active);

create table if not exists public.bandwidth_usage (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  bytes_used  bigint not null,
  proxy_type  proxy_type not null,
  recorded_at timestamptz not null default now()
);
create index if not exists bandwidth_usage_user_idx on public.bandwidth_usage (user_id, recorded_at desc);

create table if not exists public.api_keys (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  key_hash    text not null,
  key_prefix  text not null,
  last_used_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists api_keys_user_idx on public.api_keys (user_id);

create table if not exists public.payment_history (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  amount            numeric not null,
  currency          text not null default 'usd',
  status            text not null,
  invoice_url       text,
  description       text,
  stripe_invoice_id text,
  created_at        timestamptz not null default now()
);
create index if not exists payment_history_user_idx on public.payment_history (user_id, created_at desc);

create table if not exists public.support_tickets (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  subject    text not null,
  body       text not null,
  status     ticket_status not null default 'open',
  priority   ticket_priority not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);

create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null,
  read       boolean not null default false,
  type       text not null default 'info',
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read);

create table if not exists public.system_announcements (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  body         text not null,
  level        text not null default 'info',
  published_at timestamptz not null default now(),
  expires_at   timestamptz
);

create table if not exists public.admin_audit_logs (
  id               uuid primary key default uuid_generate_v4(),
  admin_user_id    uuid not null references public.profiles(id) on delete cascade,
  affected_user_id uuid references public.profiles(id) on delete set null,
  action_type      text not null,
  description      text not null,
  metadata         jsonb not null default '{}',
  ip_address       inet,
  created_at       timestamptz not null default now()
);
create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs (admin_user_id);
create index if not exists admin_audit_logs_affected_idx on public.admin_audit_logs (affected_user_id);


-- ────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — enable on every table
-- ────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.proxy_orders enable row level security;
alter table public.proxy_sessions enable row level security;
alter table public.bandwidth_usage enable row level security;
alter table public.api_keys enable row level security;
alter table public.payment_history enable row level security;
alter table public.support_tickets enable row level security;
alter table public.notifications enable row level security;
alter table public.system_announcements enable row level security;
alter table public.admin_audit_logs enable row level security;


-- ────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ────────────────────────────────────────────────────────────────
-- SIGNUP TRIGGER
-- Fires after every new Supabase Auth user is created.
-- Creates: profile row + free-tier subscription + welcome notification.
-- ────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Profile (account immediately active so dashboard works right away)
  insert into public.profiles (id, email, username, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'active'
  )
  on conflict (id) do nothing;

  -- Free-tier subscription (1 GB bandwidth)
  insert into public.subscriptions
    (user_id, plan, status, bandwidth_gb, bandwidth_used_gb, proxy_type,
     current_period_start, current_period_end)
  values
    (new.id, 'free', 'active', 1, 0, 'rotating_residential',
     now(), now() + interval '30 days')
  on conflict do nothing;

  -- Welcome notification visible inside the dashboard
  insert into public.notifications (user_id, title, body, type)
  values (
    new.id,
    'Welcome to OforsonProxies! 🎉',
    'Your account is active. You have 1 GB of free bandwidth — generate your first proxy to get started.',
    'success'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ────────────────────────────────────────────────────────────────

-- profiles
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id
    and is_admin = (select is_admin from public.profiles where id = auth.uid())
    and account_status = (select account_status from public.profiles where id = auth.uid()));

drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Allow the trigger (runs as security definer) to insert profiles
drop policy if exists "profiles trigger insert" on public.profiles;
create policy "profiles trigger insert" on public.profiles for insert
  with check (true);

-- subscriptions
drop policy if exists "subs self read" on public.subscriptions;
create policy "subs self read" on public.subscriptions for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "subs trigger insert" on public.subscriptions;
create policy "subs trigger insert" on public.subscriptions for insert
  with check (true);

drop policy if exists "subs admin write" on public.subscriptions;
create policy "subs admin write" on public.subscriptions for all
  using (public.is_admin()) with check (public.is_admin());

-- proxy_orders
drop policy if exists "orders self read" on public.proxy_orders;
create policy "orders self read" on public.proxy_orders for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "orders self insert" on public.proxy_orders;
create policy "orders self insert" on public.proxy_orders for insert
  with check (auth.uid() = user_id);

drop policy if exists "orders admin write" on public.proxy_orders;
create policy "orders admin write" on public.proxy_orders for all
  using (public.is_admin()) with check (public.is_admin());

-- proxy_sessions
drop policy if exists "sessions self read" on public.proxy_sessions;
create policy "sessions self read" on public.proxy_sessions for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "sessions self insert" on public.proxy_sessions;
create policy "sessions self insert" on public.proxy_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "sessions self update" on public.proxy_sessions;
create policy "sessions self update" on public.proxy_sessions for update
  using (auth.uid() = user_id);

-- bandwidth_usage
drop policy if exists "bw self read" on public.bandwidth_usage;
create policy "bw self read" on public.bandwidth_usage for select
  using (auth.uid() = user_id or public.is_admin());

-- api_keys
drop policy if exists "keys self read" on public.api_keys;
create policy "keys self read" on public.api_keys for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "keys self insert" on public.api_keys;
create policy "keys self insert" on public.api_keys for insert
  with check (auth.uid() = user_id);

drop policy if exists "keys self update" on public.api_keys;
create policy "keys self update" on public.api_keys for update
  using (auth.uid() = user_id);

-- payment_history
drop policy if exists "payments self read" on public.payment_history;
create policy "payments self read" on public.payment_history for select
  using (auth.uid() = user_id or public.is_admin());

-- support_tickets
drop policy if exists "tickets self read" on public.support_tickets;
create policy "tickets self read" on public.support_tickets for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "tickets self insert" on public.support_tickets;
create policy "tickets self insert" on public.support_tickets for insert
  with check (auth.uid() = user_id);

drop policy if exists "tickets self update" on public.support_tickets;
create policy "tickets self update" on public.support_tickets for update
  using (auth.uid() = user_id and status <> 'closed');

-- notifications
drop policy if exists "notif self read" on public.notifications;
create policy "notif self read" on public.notifications for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "notif self update" on public.notifications;
create policy "notif self update" on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "notif trigger insert" on public.notifications;
create policy "notif trigger insert" on public.notifications for insert
  with check (true);

-- system_announcements (publicly readable)
drop policy if exists "announce read all" on public.system_announcements;
create policy "announce read all" on public.system_announcements for select
  using (true);

drop policy if exists "announce admin write" on public.system_announcements;
create policy "announce admin write" on public.system_announcements for all
  using (public.is_admin()) with check (public.is_admin());

-- admin_audit_logs
drop policy if exists "audit admin read" on public.admin_audit_logs;
create policy "audit admin read" on public.admin_audit_logs for select
  using (public.is_admin());

drop policy if exists "audit admin write" on public.admin_audit_logs;
create policy "audit admin write" on public.admin_audit_logs for insert
  with check (public.is_admin() and admin_user_id = auth.uid());
