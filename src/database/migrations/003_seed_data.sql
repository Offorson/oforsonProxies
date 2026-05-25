-- =====================================================
-- Oforson Proxies — Optional demo seed data
-- Run only in non-production environments
-- =====================================================

-- Sample announcement
insert into public.system_announcements (title, body, level)
values
  ('Welcome to Oforson Proxies', 'Thanks for joining us. Generate your first proxy from the dashboard.', 'info'),
  ('New rotating residential pool in LATAM', 'Adds 4M+ Brazil and Mexico IPs to the rotating pool.', 'info')
on conflict do nothing;
