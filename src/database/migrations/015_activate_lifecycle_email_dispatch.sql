-- =====================================================
-- 015_activate_lifecycle_email_dispatch.sql
-- Activates transactional-email dispatch for the subscription lifecycle.
--
-- Updates private.dispatch_lifecycle_email so the DB trigger can reach
-- the deployed `subscription-lifecycle` edge function. The trigger now
-- sends BOTH credentials the function understands:
--   * Authorization: Bearer <service-role key>   (works with zero extra
--     edge-function env config), and
--   * x-lifecycle-secret: <shared secret>         (used if the function
--     has a LIFECYCLE_SHARED_SECRET env set).
-- The function accepts either, so whichever is configured wins.
--
-- The matching private.app_config rows carry real credentials and are
-- therefore inserted OUT OF BAND (see the commented template at the
-- bottom) — this migration file deliberately contains no secrets.
--
-- Applied to project xuwqhjgovdwiokubnjjd as migration
-- "activate_lifecycle_email_dispatch". Idempotent / safe to re-run.
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
  v_url     text;
  v_secret  text;
  v_key     text;
  v_headers jsonb;
begin
  select value into v_url    from private.app_config where key = 'lifecycle_function_url';
  select value into v_secret from private.app_config where key = 'lifecycle_shared_secret';
  select value into v_key    from private.app_config where key = 'lifecycle_service_key';

  -- No URL configured => email dispatch stays dormant (status change
  -- and proxy suspension/release still apply).
  if v_url is null or length(trim(v_url)) = 0 then
    return;
  end if;

  v_headers := jsonb_build_object('Content-Type', 'application/json');
  if v_secret is not null and length(trim(v_secret)) > 0 then
    v_headers := v_headers || jsonb_build_object('x-lifecycle-secret', v_secret);
  end if;
  if v_key is not null and length(trim(v_key)) > 0 then
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_key);
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('event', p_event, 'subscription_id', p_subscription_id),
    headers := v_headers
  );
exception when others then
  -- A dispatch failure must never block or roll back the status change.
  raise warning '[lifecycle] dispatch_lifecycle_email(%, %) failed: %',
    p_subscription_id, p_event, sqlerrm;
end;
$$;

-- ---- app_config (run separately with real values) --------------------
-- insert into private.app_config (key, value) values
--   ('lifecycle_function_url',
--    'https://xuwqhjgovdwiokubnjjd.supabase.co/functions/v1/subscription-lifecycle'),
--   ('lifecycle_service_key',  '<project service-role key>'),
--   ('lifecycle_shared_secret','<random secret; optionally also set as the '
--                            || 'LIFECYCLE_SHARED_SECRET edge-function env>')
-- on conflict (key) do update set value = excluded.value, updated_at = now();
