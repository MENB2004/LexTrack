-- =======================================================
-- ⚖️ LexTrack — Daily Digest Email Setup
-- Run this ENTIRE script in Supabase Dashboard → SQL Editor
-- =======================================================

-- 1. ADD digest_enabled COLUMN TO PROFILES
alter table profiles add column if not exists digest_enabled boolean not null default false;

-- 2. ENABLE REQUIRED EXTENSIONS (pg_cron + pg_net)
-- pg_cron: schedules recurring jobs inside PostgreSQL
-- pg_net: allows PostgreSQL to make HTTP requests to Edge Functions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 3. SCHEDULE DAILY DIGEST EMAIL AT 8:00 AM IST (2:30 AM UTC)
-- This calls the 'send-daily-digest' Edge Function every day.
-- Replace <YOUR_SERVICE_ROLE_KEY> with your Supabase Service Role Key
-- (found in Project Settings → API → service_role key)

select cron.schedule(
  'daily-digest-email',           -- Job name
  '30 2 * * *',                   -- Cron: 2:30 AM UTC = 8:00 AM IST
  $$
  select
    net.http_post(
      url := 'https://wfspwemzbprucailzuvr.supabase.co/functions/v1/send-daily-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{"source": "pg_cron"}'::jsonb
    ) as request_id;
  $$
);

-- ===================================================
-- VERIFICATION QUERIES (run these after setup):
-- ===================================================

-- Check the cron job was registered:
-- SELECT * FROM cron.job;

-- Check digest_enabled column exists:
-- SELECT id, email, digest_enabled FROM profiles LIMIT 5;

-- To manually unschedule later:
-- SELECT cron.unschedule('daily-digest-email');
