-- =======================================================
-- ⚖️ LexTrack Schema Migration - Old vs. New Cases & Dual Hearings
-- Execute this script in the Supabase SQL Editor
-- =======================================================

-- 1. ADD CASE CATEGORY AND LAST HEARING DATE COLUMNS TO CASES
alter table cases add column if not exists case_category text default 'New';
alter table cases add column if not exists last_hearing_date date;

-- 2. CREATE INDEX FOR LAST HEARING DATE
create index if not exists idx_cases_last_hearing on cases(user_id, last_hearing_date);
