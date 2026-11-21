-- Apply once to existing projects, and after schema.sql on a fresh database.
begin;
create table if not exists public.learning_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  data jsonb not null check (jsonb_typeof(data) = 'object')
);
alter table public.learning_progress enable row level security;
revoke all on public.learning_progress from public, anon, authenticated;
grant select, insert, update on public.learning_progress to authenticated;
drop policy if exists "Manage own learning progress" on public.learning_progress;
create policy "Manage own learning progress" on public.learning_progress
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
notify pgrst, 'reload schema';
commit;
