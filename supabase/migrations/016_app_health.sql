-- Pititi Watchers 016: app health. The scheduled notification jobs report each good run; a watchdog checks every
-- hour and, if one missed its slot, sends the admin ONE notification (at most every 12 hours). Settings shows it too.
-- Run in Supabase > SQL Editor BEFORE redeploying the notify function. Safe to run more than once.

create table if not exists public.job_runs (
  job text primary key check (job in ('reminders', 'evening')),
  -- Last time the job finished without an error (written by the notify function)
  last_ok timestamptz not null default now(),
  last_result jsonb not null default '{}'::jsonb,
  -- Last time the admin was warned about this job
  last_alert timestamptz
);
-- Start the clock now, so a fresh install doesn't alert before the jobs had a chance to run
insert into public.job_runs (job) values ('reminders'), ('evening') on conflict (job) do nothing;

alter table public.job_runs enable row level security;
drop policy if exists "admin reads app health" on public.job_runs;
create policy "admin reads app health" on public.job_runs for select to authenticated using (public.is_admin());
-- Writes only from the notify function (service role, which bypasses these rules) and the watchdog below

-- How late each job may be before it counts as missed
create or replace function public.pititi_stale_jobs()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(job order by job), '{}')
  from public.job_runs
  where (job = 'reminders' and last_ok < now() - interval '25 hours')
     or (job = 'evening' and last_ok < now() - interval '2 hours')
$$;
revoke all on function public.pititi_stale_jobs() from public, anon, authenticated;

-- The watchdog: warn the admin once (per 12 hours) when a job is late
create or replace function public.pititi_health_check()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  stale text[] := public.pititi_stale_jobs();
  due text[];
begin
  select coalesce(array_agg(job), '{}') into due
  from public.job_runs
  where job = any (stale) and (last_alert is null or last_alert < now() - interval '12 hours');
  if cardinality(due) = 0 then
    return '{}';
  end if;
  update public.job_runs set last_alert = now() where job = any (due);
  perform public.pititi_call(jsonb_build_object('type', 'health', 'stale', to_jsonb(due)));
  return due;
end;
$$;
revoke all on function public.pititi_health_check() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('pititi-health') where exists (select 1 from cron.job where jobname = 'pititi-health');
  perform cron.schedule('pititi-health', '30 * * * *', $job$ select public.pititi_health_check() $job$);
end $$;

-- Self-test, rolled back: a late job is reported once, then not again within 12 hours
do $$
declare
  first_run text[];
  second_run text[];
begin
  update public.job_runs set last_ok = now() - interval '3 days', last_alert = null where job = 'reminders';
  first_run := public.pititi_health_check();
  second_run := public.pititi_health_check();
  if not ('reminders' = any (first_run)) or cardinality(second_run) <> 0 then
    raise exception 'App health self-test FAILED: first %, second %', first_run, second_run;
  end if;
  raise exception 'selftest_rollback';
exception
  when others then
    if sqlerrm <> 'selftest_rollback' then
      raise;
    end if;
end $$;

select 'app health ready' as status, (select count(*) from public.job_runs) as jobs;
