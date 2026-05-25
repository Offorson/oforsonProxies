-- =====================================================
-- Oforson Proxies — Row Level Security policies
-- Run AFTER 001_init_schema.sql
-- =====================================================

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: is the current account active?
create or replace function public.is_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select account_status = 'active' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Enable RLS on every table
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

-- =====================================================
-- profiles
-- =====================================================
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent privilege escalation: regular users cannot flip is_admin
    and is_admin = (select is_admin from public.profiles where id = auth.uid())
    and account_status = (select account_status from public.profiles where id = auth.uid())
  );

drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- subscriptions
-- =====================================================
drop policy if exists "subs self read" on public.subscriptions;
create policy "subs self read"
  on public.subscriptions for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "subs admin write" on public.subscriptions;
create policy "subs admin write"
  on public.subscriptions for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- proxy_orders
-- =====================================================
drop policy if exists "orders self read" on public.proxy_orders;
create policy "orders self read"
  on public.proxy_orders for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "orders self insert" on public.proxy_orders;
create policy "orders self insert"
  on public.proxy_orders for insert
  with check (auth.uid() = user_id);

drop policy if exists "orders admin write" on public.proxy_orders;
create policy "orders admin write"
  on public.proxy_orders for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- proxy_sessions
-- =====================================================
drop policy if exists "sessions self read" on public.proxy_sessions;
create policy "sessions self read"
  on public.proxy_sessions for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "sessions self insert" on public.proxy_sessions;
create policy "sessions self insert"
  on public.proxy_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "sessions self update" on public.proxy_sessions;
create policy "sessions self update"
  on public.proxy_sessions for update
  using (auth.uid() = user_id);

drop policy if exists "sessions admin write" on public.proxy_sessions;
create policy "sessions admin write"
  on public.proxy_sessions for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- bandwidth_usage
-- =====================================================
drop policy if exists "bw self read" on public.bandwidth_usage;
create policy "bw self read"
  on public.bandwidth_usage for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "bw admin write" on public.bandwidth_usage;
create policy "bw admin write"
  on public.bandwidth_usage for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- api_keys
-- =====================================================
drop policy if exists "keys self read" on public.api_keys;
create policy "keys self read"
  on public.api_keys for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "keys self insert" on public.api_keys;
create policy "keys self insert"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

drop policy if exists "keys self update" on public.api_keys;
create policy "keys self update"
  on public.api_keys for update
  using (auth.uid() = user_id);

drop policy if exists "keys admin all" on public.api_keys;
create policy "keys admin all"
  on public.api_keys for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- payment_history
-- =====================================================
drop policy if exists "payments self read" on public.payment_history;
create policy "payments self read"
  on public.payment_history for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "payments admin write" on public.payment_history;
create policy "payments admin write"
  on public.payment_history for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- support_tickets
-- =====================================================
drop policy if exists "tickets self read" on public.support_tickets;
create policy "tickets self read"
  on public.support_tickets for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "tickets self insert" on public.support_tickets;
create policy "tickets self insert"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

drop policy if exists "tickets self update" on public.support_tickets;
create policy "tickets self update"
  on public.support_tickets for update
  using (auth.uid() = user_id and status <> 'closed');

drop policy if exists "tickets admin all" on public.support_tickets;
create policy "tickets admin all"
  on public.support_tickets for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- notifications
-- =====================================================
drop policy if exists "notif self read" on public.notifications;
create policy "notif self read"
  on public.notifications for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "notif self update" on public.notifications;
create policy "notif self update"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "notif admin all" on public.notifications;
create policy "notif admin all"
  on public.notifications for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- system_announcements (publicly readable)
-- =====================================================
drop policy if exists "announce read all" on public.system_announcements;
create policy "announce read all"
  on public.system_announcements for select
  using (true);

drop policy if exists "announce admin write" on public.system_announcements;
create policy "announce admin write"
  on public.system_announcements for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- admin_audit_logs (admin-only)
-- =====================================================
drop policy if exists "audit admin read" on public.admin_audit_logs;
create policy "audit admin read"
  on public.admin_audit_logs for select
  using (public.is_admin());

drop policy if exists "audit admin write" on public.admin_audit_logs;
create policy "audit admin write"
  on public.admin_audit_logs for insert
  with check (public.is_admin() and admin_user_id = auth.uid());
