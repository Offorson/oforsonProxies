-- =====================================================
-- Oforson Proxies — Initial schema
-- Run this in the Supabase SQL editor BEFORE 002_rls_policies.sql
-- =====================================================

-- Required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================
-- ENUM TYPES
-- =========================
do $$
begin
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
end$$;

-- =========================
-- TABLES
-- =========================

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text unique,
  avatar_url text,
  is_admin boolean not null default false,
  account_status account_status not null default 'pending_verification',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

-- subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null,
  status subscription_status not null default 'trialing',
  bandwidth_gb numeric not null default 0,
  bandwidth_used_gb numeric not null default 0,
  proxy_type proxy_type not null default 'rotating_residential',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '30 days',
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

-- proxy_orders
create table if not exists public.proxy_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  proxy_type proxy_type not null,
  quantity integer not null default 1,
  total_amount numeric not null default 0,
  status order_status not null default 'pending',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists proxy_orders_user_idx on public.proxy_orders (user_id);

-- proxy_sessions
create table if not exists public.proxy_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  proxy_type proxy_type not null,
  country_code text not null,
  ip_address inet,
  port integer,
  username text,
  password text,
  bandwidth_used bigint not null default 0,
  is_active boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists proxy_sessions_user_idx on public.proxy_sessions (user_id);
create index if not exists proxy_sessions_active_idx on public.proxy_sessions (user_id, is_active);

-- bandwidth_usage
create table if not exists public.bandwidth_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bytes_used bigint not null,
  proxy_type proxy_type not null,
  recorded_at timestamptz not null default now()
);

create index if not exists bandwidth_usage_user_idx on public.bandwidth_usage (user_id, recorded_at desc);

-- api_keys
create table if not exists public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_user_idx on public.api_keys (user_id);

-- payment_history
create table if not exists public.payment_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  currency text not null default 'usd',
  status text not null,
  invoice_url text,
  description text,
  stripe_invoice_id text,
  created_at timestamptz not null default now()
);

create index if not exists payment_history_user_idx on public.payment_history (user_id, created_at desc);

-- support_tickets
create table if not exists public.support_tickets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  body text not null,
  status ticket_status not null default 'open',
  priority ticket_priority not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);

-- notifications
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  type text not null default 'info',
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read);

-- system_announcements
create table if not exists public.system_announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  level text not null default 'info',
  published_at timestamptz not null default now(),
  expires_at timestamptz
);

-- admin_audit_logs
create table if not exists public.admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  affected_user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  description text not null,
  metadata jsonb not null default '{}',
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs (admin_user_id);
create index if not exists admin_audit_logs_affected_idx on public.admin_audit_logs (affected_user_id);

-- =========================
-- TRIGGERS
-- =========================

-- Auto-update profiles.updated_at
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile when a user signs up via Supabase auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, account_status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 'pending_verification')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
