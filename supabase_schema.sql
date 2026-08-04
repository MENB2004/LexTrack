-- ==========================================
-- ⚖️ LexTrack Database Schema & RLS Policies
-- Execute in Supabase SQL Editor
-- ==========================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. CASES TABLE
create table if not exists cases (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users(id) on delete cascade,
  case_number       text not null unique,
  client_name       text not null,
  case_type         text not null,        -- 'Civil' | 'Criminal' | 'Family' | 'Corporate'
  date_filed        date not null,
  next_hearing_date date,
  status            text not null default 'Active',   -- 'Active' | 'Closed'
  is_priority       boolean not null default false,   -- Star / Important flag
  notes             text,
  closing_note      text,
  closed_at         timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Index for fast priority & date queries
create index if not exists idx_cases_priority on cases(user_id, is_priority, next_hearing_date);

-- 2. PROFILES TABLE (stores Expo push notification tokens & user meta)
create table if not exists profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  expo_push_token  text,
  created_at       timestamptz default now()
);

-- 3. ROW LEVEL SECURITY (RLS)
alter table cases    enable row level security;
alter table profiles enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Users manage their own cases" on cases;
drop policy if exists "Users manage their own profile" on profiles;

create policy "Users manage their own cases"
  on cases for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4. AUTO-UPDATE updated_at TRIGGER FUNCTION
create or replace function update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on cases;

create trigger set_updated_at
before update on cases
for each row execute procedure update_timestamp();
