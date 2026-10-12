-- Pititi Watchers 009: problems the app hits on someone's phone are reported here, so they get fixed
-- before anyone has to send a screenshot. Only family members can report; only the admin can read.
-- No personal content is stored: the error text, where in the app, app version and phone type.

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  person_id uuid references public.people (id) on delete set null default public.my_person_id(),
  version text not null default '' check (char_length(version) <= 60),
  screen text not null default '' check (char_length(screen) <= 60),
  message text not null check (char_length(message) between 1 and 500),
  stack text not null default '' check (char_length(stack) <= 4000),
  user_agent text not null default '' check (char_length(user_agent) <= 300)
);
create index if not exists client_errors_recent on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;
drop policy if exists "members report problems" on public.client_errors;
drop policy if exists "admin reads problems" on public.client_errors;
drop policy if exists "admin clears problems" on public.client_errors;
create policy "members report problems" on public.client_errors
  for insert to authenticated with check (public.is_member() and (person_id is null or person_id = public.my_person_id()));
create policy "admin reads problems" on public.client_errors
  for select to authenticated using (public.is_admin());
create policy "admin clears problems" on public.client_errors
  for delete to authenticated using (public.is_admin());

-- Keep it small: anything older than 60 days is cleared daily
do $$
begin
  perform cron.unschedule('pititi-clear-errors') where exists (select 1 from cron.job where jobname = 'pititi-clear-errors');
  perform cron.schedule('pititi-clear-errors', '30 3 * * *', $job$ delete from public.client_errors where created_at < now() - interval '60 days' $job$);
end $$;

select 'error reports ready' as status, count(*) as reports from public.client_errors;
