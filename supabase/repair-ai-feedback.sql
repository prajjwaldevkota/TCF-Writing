-- Run on YOUR Supabase project, after schema.sql. Never use the upstream DB.
begin;
alter table public.submissions add column if not exists ai_feedback jsonb;
drop policy if exists "Users can update own submissions" on public.submissions;
create policy "Users can update own submissions" on public.submissions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant update on public.submissions to authenticated;
notify pgrst, 'reload schema';
commit;
å