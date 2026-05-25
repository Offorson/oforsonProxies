-- =====================================================
-- Oforson Proxies - Security Advisor fixes
-- Resolves the 11 warnings flagged by Supabase's lint:
--   1. Function search path mutable (touch_updated_at)
--   2-4. RLS policies with `with check (true)` on
--        profiles / subscriptions / notifications inserts
--   5-10. SECURITY DEFINER functions exposed via RPC
--        (handle_new_user, is_admin, rls_auto_enable)
-- (#11, leaked-password protection, is a dashboard toggle.)
--
-- Safe to run on an existing project. Idempotent.
-- =====================================================

begin;

-- ---------------------------------------------------------
-- 1. Pin search_path on touch_updated_at so the function
--    can't be tricked into resolving objects in a hostile
--    schema that appears earlier in someone's search_path.
-- ---------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 2. Drop the three `with check (true)` insert policies.
--    The handle_new_user() trigger is SECURITY DEFINER and
--    runs as the function owner (postgres), which bypasses
--    RLS, so these permissive policies aren't doing useful
--    work - they were just defeating row-level security
--    for INSERT on three tables.
--
--    If you ever need a non-trigger insert path on these
--    tables, add a scoped policy like:
--      with check (auth.uid() = user_id)
--    instead of `with check (true)`.
-- ---------------------------------------------------------
drop policy if exists "profiles trigger insert" on public.profiles;
drop policy if exists "subs trigger insert"     on public.subscriptions;
drop policy if exists "notif trigger insert"    on public.notifications;

-- ---------------------------------------------------------
-- 3. Lock down SECURITY DEFINER functions that PostgREST
--    would otherwise expose at /rest/v1/rpc/<name>.
--
--    handle_new_user: trigger-only. It runs from the
--                     on_auth_user_created trigger, which
--                     does NOT require the inserting role to
--                     hold EXECUTE. Safe to revoke from
--                     every client role.
--    rls_auto_enable: appears to be a Supabase-installed
--                     helper. Revoke from public roles.
--
--    is_admin() is deliberately NOT revoked. It is called
--    inside the RLS policies in 002_rls_policies.sql, and
--    RLS policy expressions are evaluated as the CALLING
--    role -- so `anon` / `authenticated` MUST keep EXECUTE
--    on it. Revoking it makes every policy that references
--    is_admin() fail with `permission denied for function
--    is_admin`, which silently empties the dashboard,
--    settings and notifications for every signed-in user.
--    The function is SECURITY DEFINER and only ever reports
--    whether the *current* caller is an admin, so leaving it
--    callable is not a meaningful exposure. If Supabase's
--    advisor still flags it, suppress that single warning.
-- ---------------------------------------------------------
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- Keep is_admin() callable by the client roles that RLS
-- evaluates policies as (idempotent — restores the grant
-- even if an earlier run of this migration revoked it).
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;

-- rls_auto_enable may not exist in every project; wrap in a
-- do-block so this migration doesn't fail if it isn't there.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon';
    execute 'revoke execute on function public.rls_auto_enable() from authenticated';
  end if;
end$$;

commit;

-- ---------------------------------------------------------
-- Smoke check: which roles can still execute these functions?
--   handle_new_user / rls_auto_enable / touch_updated_at:
--     expect only postgres / service_role / owners.
--   is_admin: expect authenticated + anon = true as well
--     (required by the RLS policies — see note above).
-- ---------------------------------------------------------
select
  n.nspname as schema,
  p.proname as function,
  r.rolname as role,
  has_function_privilege(r.rolname, p.oid, 'execute') as can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (
  select rolname from pg_roles
  where rolname in ('anon','authenticated','service_role','postgres')
) r
where n.nspname = 'public'
  and p.proname in ('handle_new_user','is_admin','rls_auto_enable','touch_updated_at')
order by p.proname, r.rolname;
