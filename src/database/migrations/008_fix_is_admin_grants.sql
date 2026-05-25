-- ================================================================
-- HOTFIX — restore EXECUTE on public.is_admin()
--
-- 007_security_advisor_fixes.sql revoked EXECUTE on
-- public.is_admin() from `anon` and `authenticated`. That was a
-- mistake based on a wrong assumption in 007's comments.
--
-- is_admin() is referenced by the RLS policies created in
-- 002_rls_policies.sql on essentially every user-facing table:
--   profiles, subscriptions, proxy_orders, proxy_sessions,
--   bandwidth_usage, api_keys, payment_history, support_tickets,
--   notifications, system_announcements, admin_audit_logs.
--
-- RLS policy expressions are evaluated AS THE CALLING ROLE — not
-- as the table owner. With EXECUTE revoked, every authenticated
-- SELECT against those tables fails with:
--     permission denied for function is_admin
-- The Supabase JS client surfaces that as { data: null, error },
-- so the app does not crash — it just renders as though the
-- account had no subscription, no proxies and no usage:
--   * Dashboard shows 0 proxies / 0 GB / "free" plan for everyone.
--   * Settings cannot load the profile row.
--   * The notifications dropdown shows no plan card.
--
-- This migration re-grants EXECUTE so the policies work again.
-- is_admin() is SECURITY DEFINER and only ever reports whether the
-- *current* caller is an admin, so it is safe to leave callable.
--
-- Run AFTER 007. Paste into Supabase → SQL Editor → Run.
-- Idempotent: safe to run multiple times.
-- ================================================================

begin;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;

commit;

-- ----------------------------------------------------------------
-- Smoke check 1 — confirm the grant.
-- Expect can_execute = true for anon, authenticated, service_role,
-- postgres.
-- ----------------------------------------------------------------
select
  r.rolname as role,
  has_function_privilege(r.rolname, 'public.is_admin()', 'execute') as can_execute
from (
  select unnest(array['anon', 'authenticated', 'service_role', 'postgres']) as rolname
) r
order by r.rolname;

-- ----------------------------------------------------------------
-- Smoke check 2 — prove an RLS-gated read works again.
-- Run this while signed in as a seeded QA user, e.g.
-- biz.static@qa.oforson.test. Expect exactly one row: the
-- 'business' / 'static_residential' subscription. Before this fix
-- it returned a permission-denied error instead.
-- ----------------------------------------------------------------
-- select plan, status, proxy_type, bandwidth_used_gb, bandwidth_gb
-- from public.subscriptions
-- where user_id = auth.uid();
