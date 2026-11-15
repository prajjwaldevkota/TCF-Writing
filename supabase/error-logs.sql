-- Run once on YOUR Supabase project. Safe to rerun.
begin;
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null,
  source text not null check (source in ('server', 'client')),
  stage text not null check (stage in ('configuration', 'request', 'provider_http', 'provider_network', 'client_network', 'assessment')),
  code text not null check (code in ('missing_credentials', 'invalid_request', 'http_error', 'timeout', 'network_error', 'invalid_json', 'invalid_assessment', 'truncated_response', 'blocked_response')),
  model text,
  key_source text check (key_source in ('primary', 'backup')),
  attempt smallint not null default 0 check (attempt between 0 and 2),
  http_status smallint check (http_status between 100 and 599),
  duration_ms integer not null default 0 check (duration_ms between 0 and 600000),
  retry_after_seconds integer check (retry_after_seconds between 0 and 86400),
  error_type text,
  provider_code text,
  client_context jsonb,
  deployment text,
  region text
);
create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc, id desc);
create index if not exists error_logs_request_id_idx on public.error_logs (request_id);
alter table public.error_logs enable row level security;
revoke all on public.error_logs from anon, authenticated;
grant select on public.error_logs to authenticated;
grant all on public.error_logs to service_role;
drop policy if exists "Admins can read error logs" on public.error_logs;
create policy "Admins can read error logs" on public.error_logs
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- No browser insert/update/delete policies. Only the server's service role writes.
notify pgrst, 'reload schema';
commit;
