-- Apply after evaluation-jobs.sql, before deploying the review cache. Safe to rerun.
begin;
alter table public.evaluation_jobs add column if not exists cache_scope text;
alter table public.evaluation_jobs add column if not exists cache_key text;
alter table public.evaluation_jobs add column if not exists cache_expires_at timestamptz;
create index if not exists evaluation_jobs_cache_idx on public.evaluation_jobs(cache_scope, cache_key, created_at desc)
  where status = 'completed' and cache_key is not null;
-- Existing owner/admin RLS and service-only write permissions remain in force.
notify pgrst, 'reload schema';
commit;
