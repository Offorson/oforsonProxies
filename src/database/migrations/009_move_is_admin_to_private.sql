-- ================================================================
-- 009_move_is_admin_to_private.sql
--
-- Resolves the two Supabase security-advisor findings:
--   * "Public Can Execute SECURITY DEFINER Function"       public.is_admin()
--   * "Signed-In Users Can Execute SECURITY DEFINER Func."  public.is_admin()
--
-- STATUS: APPLIED to the live project (xuwqhjgovdwiokubnjjd) on
-- 2026-05-20 as Supabase migration "move_is_admin_to_private".
-- Verified live: is_admin() now lives in `private`, 0 copies remain
-- in an exposed schema, all 15 RLS policies that call the helper
-- followed the move, and a signed-in QA user still reads exactly
-- their own rows (no "permission denied for function is_admin").
--
-- ROOT CAUSE
-- ----------
-- public.is_admin() is SECURITY DEFINER and lived in the `public`
-- schema. PostgREST exposes `public` as the REST API, so any function
-- there that a role can EXECUTE is callable at /rest/v1/rpc/<name>.
-- 007 and 008 keep EXECUTE granted to `anon` + `authenticated`
-- because the RLS policies call is_admin() and RLS evaluates policy
-- expressions AS THE CALLING ROLE -- revoking EXECUTE breaks every
-- gated table (that was the 007 -> 008 regression).
--
-- THE FIX
-- -------
-- Move is_admin() (and the sibling helper is_account_active(), if it
-- exists) into a `private` schema PostgREST does NOT expose. That
-- removes the /rest/v1/rpc/is_admin endpoint while keeping the
-- function callable from inside SQL -- so the RLS policies keep
-- working unchanged. ALTER FUNCTION ... SET SCHEMA preserves the
-- function OID, so policies follow the move automatically.
--
-- NOTE: this project only has is_admin(); is_account_active() from
-- 002 was never created here, so the guarded blocks below skip it.
-- No application code calls is_admin() over RPC (the app reads
-- profiles.is_admin directly).
--
-- Idempotent: safe to run multiple times.
--
-- FOLLOW-UPS:
--   * 000_run_this_in_supabase.sql and 002_rls_policies.sql still
--     CREATE is_admin() in `public`. Re-run this migration if you
--     ever re-run either of those.
--   * Confirm `private` is NOT listed under
--     Project Settings -> API -> Exposed schemas (default: it is not).
-- ================================================================

-- A schema PostgREST does not expose. Functions here are reachable
-- from SQL / RLS but never from /rest/v1/rpc.
create schema if not exists private;

-- Move the SECURITY DEFINER helper(s) out of the exposed `public`
-- schema. Guarded so a second run -- and a missing is_account_active
-- -- are both no-ops.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute 'alter function public.is_admin() set schema private';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_account_active'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute 'alter function public.is_account_active() set schema private';
  end if;
end$$;

-- RLS evaluates these helpers as the CALLING role, so anon +
-- authenticated must keep USAGE on the schema and EXECUTE on the
-- function. `private` is not an exposed schema, so there is no RPC
-- endpoint to abuse. Guarded so it works whether or not each helper
-- exists in this database.
grant usage on schema private to anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'is_admin'
  ) then
    execute 'grant execute on function private.is_admin() to anon, authenticated, service_role';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'is_account_active'
  ) then
    execute 'grant execute on function private.is_account_active() to anon, authenticated, service_role';
  end if;
end$$;

-- ----------------------------------------------------------------
-- Smoke checks (optional -- run manually after applying).
--
-- 1. is_admin() should live in `private`, not `public`:
--      select n.nspname, p.proname
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where p.proname = 'is_admin';
--
-- 2. RLS still works -- run while signed in as a seeded QA user,
--    expect their own rows, NOT a permission-denied error:
--      select count(*) from public.subscriptions
--      where user_id = auth.uid();
-- ----------------------------------------------------------------
