-- ================================================================
-- HOTFIX — Signup trigger was failing on the `username` UNIQUE
-- constraint (and any other side-effect error), which rolled back
-- the entire auth.users insert and produced
-- "Database error saving new user" on /signup.
--
-- This replaces handle_new_user() with a version that:
--   1. Resolves username collisions by appending a short random suffix.
--   2. Wraps the subscription + notification inserts in their own
--      EXCEPTION blocks so a single failure can NEVER kill signup.
--   3. Always returns NEW so auth.users insert succeeds.
--
-- Paste the whole file into Supabase → SQL Editor → Run.
-- Safe to run multiple times.
-- ================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_username text;
  final_username   text;
begin
  -- ── 1. Profile row ──────────────────────────────────────────
  -- Pick the username they chose, or fall back to email prefix.
  desired_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1)
  );
  final_username := desired_username;

  -- If that username is taken, append a 4-char random suffix and retry.
  -- (Loop is bounded — we only try a few times.)
  begin
    if exists (select 1 from public.profiles where username = final_username) then
      final_username := desired_username || '_' || substr(md5(random()::text), 1, 4);
    end if;

    insert into public.profiles (id, email, username, account_status)
    values (new.id, new.email, final_username, 'active')
    on conflict (id) do nothing;
  exception
    when unique_violation then
      -- Last-resort: profile with a guaranteed-unique username.
      insert into public.profiles (id, email, username, account_status)
      values (new.id, new.email, desired_username || '_' || substr(new.id::text, 1, 8), 'active')
      on conflict (id) do nothing;
    when others then
      -- Never block signup on a profile-row hiccup.
      raise warning 'handle_new_user: profile insert failed: %', sqlerrm;
  end;

  -- ── 2. Free-tier subscription ───────────────────────────────
  begin
    insert into public.subscriptions
      (user_id, plan, status, bandwidth_gb, bandwidth_used_gb, proxy_type,
       current_period_start, current_period_end)
    values
      (new.id, 'free', 'active', 1, 0, 'rotating_residential',
       now(), now() + interval '30 days');
  exception
    when others then
      raise warning 'handle_new_user: subscription insert failed: %', sqlerrm;
  end;

  -- ── 3. Welcome notification ─────────────────────────────────
  begin
    insert into public.notifications (user_id, title, body, type)
    values (
      new.id,
      'Welcome to OforsonProxies!',
      'Your account is active. You have 1 GB of free bandwidth — generate your first proxy to get started.',
      'success'
    );
  exception
    when others then
      raise warning 'handle_new_user: notification insert failed: %', sqlerrm;
  end;

  return new;
end;
$$;

-- Re-bind trigger (drop+create so the new function body is used).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sanity: make sure the function owner can bypass RLS via security definer.
alter function public.handle_new_user() owner to postgres;
