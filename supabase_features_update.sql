-- =======================================================
-- ⚖️ LexTrack Schema Migrations - New Features
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
create policy "Users manage their own case activities"
  on case_activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. TEAM & MULTI-USER SUPPORT
create table if not exists firms (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_by  uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

create table if not exists firm_members (
  id        uuid primary key default uuid_generate_v4(),
  firm_id   uuid references firms(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete cascade,
  role      text not null default 'associate', -- 'owner' | 'associate' | 'paralegal'
  joined_at timestamptz default now(),
  unique(firm_id, user_id)
);

-- Link cases and clients to a firm
alter table cases add column if not exists firm_id uuid references firms(id) on delete set null;
alter table clients add column if not exists firm_id uuid references firms(id) on delete set null;
alter table case_activities add column if not exists firm_id uuid references firms(id) on delete set null;

-- RLS for firms and firm_members
alter table firms enable row level security;
alter table firm_members enable row level security;

drop policy if exists "Members can view their firms" on firms;
create policy "Members can view their firms"
  on firms for select
  using (exists (select 1 from firm_members where firm_id = firms.id and user_id = auth.uid()));

drop policy if exists "Owners can manage their firms" on firms;
create policy "Owners can manage their firms"
  on firms for all
  using (created_by = auth.uid() or exists (select 1 from firm_members where firm_id = firms.id and user_id = auth.uid() and role = 'owner'));

drop policy if exists "Members can view firm members" on firm_members;
create policy "Members can view firm members"
  on firm_members for select
  using (firm_id in (select firm_id from firm_members where user_id = auth.uid()));

drop policy if exists "Owners can manage firm members" on firm_members;
create policy "Owners can manage firm members"
  on firm_members for all
  using (firm_id in (select firm_id from firm_members where user_id = auth.uid() and role = 'owner'));

-- RLS sharing policies (firm-wide)
drop policy if exists "Users manage their own or firm cases" on cases;
create policy "Users manage their own or firm cases"
  on cases for all
  using (
    auth.uid() = user_id or
    (firm_id is not null and firm_id in (select firm_id from firm_members where user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id or
    (firm_id is not null and firm_id in (select firm_id from firm_members where user_id = auth.uid()))
  );

drop policy if exists "Users manage their own or firm clients" on clients;
create policy "Users manage their own or firm clients"
  on clients for all
  using (
    auth.uid() = user_id or
    (firm_id is not null and firm_id in (select firm_id from firm_members where user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id or
    (firm_id is not null and firm_id in (select firm_id from firm_members where user_id = auth.uid()))
  );

drop policy if exists "Users manage their own or firm activities" on case_activities;
create policy "Users manage their own or firm activities"
  on case_activities for all
  using (
    auth.uid() = user_id or
    (firm_id is not null and firm_id in (select firm_id from firm_members where user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id or
    (firm_id is not null and firm_id in (select firm_id from firm_members where user_id = auth.uid()))
  );

-- 5. COURT DIRECTORY COLUMNS ON CASES
alter table cases add column if not exists court_name text;
alter table cases add column if not exists courtroom text;

-- Add bar_number, specialty, phone columns to profiles if not already there
alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists bar_number text;
alter table profiles add column if not exists specialty text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists email text;
