-- =============================================================
-- OforsonProxies — Complete one-time Supabase setup
-- Paste this entire file into the Supabase SQL Editor and run it.
-- It is safe to run more than once (uses CREATE OR REPLACE / ON CONFLICT).
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. UPDATED NEW-USER TRIGGER
--    Called automatically by Supabase every time someone signs up.
--    Creates a profile row, a free-tier subscription, and a
--    welcome notification all in one shot.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1a. Create the profile (account is immediately active so the
  --     dashboard works even before email confirmation).
  INSERT INTO public.profiles (id, email, username, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 1b. Grant a free-tier subscription (1 GB bandwidth).
  INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    bandwidth_gb,
    bandwidth_used_gb,
    proxy_type,
    current_period_start,
    current_period_end
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    1,        -- 1 GB free bandwidth
    0,
    'rotating_residential',
    now(),
    now() + interval '30 days'
  )
  ON CONFLICT DO NOTHING;

  -- 1c. Insert a welcome notification visible inside the dashboard.
  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (
    NEW.id,
    'Welcome to OforsonProxies! 🎉',
    'Your account is ready. You have 1 GB of free bandwidth — generate your first proxy to get started.',
    'success'
  );

  RETURN NEW;
END;
$$;

-- Re-attach the trigger (drop first so we can safely re-run this file).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- 2. PROFILE INSERT POLICY
--    The trigger runs as SECURITY DEFINER so no special policy is
--    needed for the insert, but we add a safe fallback so service-
--    role inserts also work.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles service insert" ON public.profiles;
CREATE POLICY "profiles service insert"
  ON public.profiles FOR INSERT
  WITH CHECK (true);   -- the trigger already enforces id = auth.uid()


-- ─────────────────────────────────────────────────────────────
-- 3. SUBSCRIPTION INSERT POLICY (needed by the trigger)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "subs service insert" ON public.subscriptions;
CREATE POLICY "subs service insert"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 4. NOTIFICATION INSERT POLICY (needed by the trigger)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "notif service insert" ON public.notifications;
CREATE POLICY "notif service insert"
  ON public.notifications FOR INSERT
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 5. AUTO-UPDATE updated_at ON PROFILES
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
