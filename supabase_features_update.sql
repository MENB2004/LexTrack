-- =======================================================
-- ⚖️ LexTrack Schema Migrations - New Features (Single-User Mode)
-- Execute this script in the Supabase SQL Editor
-- =======================================================

-- 1. CLIENTS TABLE
create table if not exists clients (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  full_name    text not null,
  phone        text,
  email        text,
  address      text,
  notes        text,
  created_at   timestamptz default now()
);

-- Enable RLS for clients
alter table clients enable row level security;
drop policy if exists "Users manage their own clients" on clients;
drop policy if exists "Users manage their own or firm clients" on clients;
create policy "Users manage their own clients"
  on clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. LINK CASES TO A CLIENT
alter table cases add column if not exists client_id uuid references clients(id) on delete set null;

-- 3. CASE TIMELINE / ACTIVITY LOG
create table if not exists case_activities (
  id           uuid primary key default uuid_generate_v4(),
  case_id      uuid references cases(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  action_type  text not null, -- 'created' | 'hearing_scheduled' | 'note_added' | 'priority_on' | 'priority_off' | 'closed' | 'reopened' | 'notes_updated'
  description  text,
  created_at   timestamptz default now()
);

-- Enable RLS for case_activities
alter table case_activities enable row level security;
drop policy if exists "Users manage their own case activities" on case_activities;
drop policy if exists "Users manage their own or firm activities" on case_activities;
create policy "Users manage their own case activities"
  on case_activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. COURT DIRECTORY COLUMNS ON CASES
alter table cases add column if not exists court_name text;
alter table cases add column if not exists courtroom text;

-- 5. PROFILE FIELDS FOR LAWYERS
alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists bar_number text;
alter table profiles add column if not exists specialty text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists email text;
