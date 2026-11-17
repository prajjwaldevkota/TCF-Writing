-- Run on your Supabase project before EVALUATION_QUEUE_ENABLED=true. Safe to rerun.
begin;
create table if not exists public.evaluation_jobs (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  token_hash text not null,
  input_hash text not null,
  input jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','retrying','completed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 9),
  next_step integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  message_id text,
  dead_letter_id text,
  response jsonb,
  model text,
  key_source text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.evaluation_jobs add column if not exists dead_letter_id text;
create index if not exists evaluation_jobs_owner_idx on public.evaluation_jobs(user_id, created_at desc);
create index if not exists evaluation_jobs_failed_idx on public.evaluation_jobs(created_at desc) where status = 'failed';
alter table public.evaluation_jobs enable row level security;
revoke all on public.evaluation_jobs from anon, authenticated;
grant select on public.evaluation_jobs to authenticated;
grant all on public.evaluation_jobs to service_role;
drop policy if exists "Read own evaluation jobs" on public.evaluation_jobs;
create policy "Read own evaluation jobs" on public.evaluation_jobs for select to authenticated
  using ((select auth.uid()) = user_id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- Guests use an unguessable capability through /api/evaluate; no guest table reads.
create or replace function public.touch_evaluation_job() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists evaluation_jobs_updated on public.evaluation_jobs;
create trigger evaluation_jobs_updated before update on public.evaluation_jobs
  for each row execute function public.touch_evaluation_job();

-- Atomically lease one attempt. Duplicate queue deliveries cannot run concurrently.
-- The lease exceeds both the provider (120s) and queue delivery (150s) deadlines.
create or replace function public.claim_evaluation_job(job_id uuid, claim_token uuid)
returns setof public.evaluation_jobs language sql security definer set search_path = '' as $$
  update public.evaluation_jobs set
    status = 'running', attempts = attempts + 1,
    lease_token = claim_token, lease_until = now() + interval '180 seconds'
  where id = job_id and attempts < 9 and
    (status in ('queued','retrying') or (status = 'running' and lease_until < now()))
  returning *;
$$;
revoke all on function public.claim_evaluation_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_evaluation_job(uuid, uuid) to service_role;

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') and
     not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'evaluation_jobs') then
    alter publication supabase_realtime add table public.evaluation_jobs;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
