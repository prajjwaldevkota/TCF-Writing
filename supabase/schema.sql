-- ===================================================
-- TCF ÉCRITURE SIMULATOR - SUPABASE SCHEMA & RLS
-- ===================================================

-- 1. Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create submissions table
create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  year text not null,
  month text not null,
  combination integer not null,
  started_at timestamp with time zone not null,
  completed_at timestamp with time zone not null,
  duration_seconds integer not null,
  task1_answer text default '' not null,
  task1_word_count integer default 0 not null,
  task2_answer text default '' not null,
  task2_word_count integer default 0 not null,
  task3_answer text default '' not null,
  task3_word_count integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;

-- 4. RLS Policies for Profiles
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);


create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- 5. RLS Policies for Submissions (CRITICAL SECURITY REQUIREMENT)
-- Users can ONLY access, create, or delete their OWN submissions.
create policy "Users can read own submissions" on public.submissions
  for select using (auth.uid() = user_id);


create policy "Users can insert own submissions" on public.submissions
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own submissions" on public.submissions
  for delete using (auth.uid() = user_id);

-- 6. Trigger to automatically create a profile entry when a new user registers
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Explicit Table Grants (Required by Supabase for all new tables / migrations from Oct 30)
grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select, insert, update, delete on public.submissions to authenticated;
grant all on public.submissions to service_role;

