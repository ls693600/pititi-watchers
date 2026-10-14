-- Pititi Watchers 011: the evening reminder ("Did you watch something today? Tap to mark").
-- Each person picks an hour (or off) in their own time zone; it's only sent if they haven't marked anything that day.
-- Run once in Supabase > SQL Editor. The last part checks everything is in place.

alter table public.people add column if not exists evening_hour smallint check (evening_hour between 0 and 23);
alter table public.people add column if not exists tz text check (char_length(tz) <= 64);
-- Language for notifications ('en' or 'pt'), set from the phone
alter table public.people add column if not exists lang text not null default 'en' check (lang in ('en', 'pt'));

-- People change only their own reminder (the admin can too); this keeps the existing role/household rules
drop function if exists public.set_evening(smallint, text);
create or replace function public.set_evening(hour smallint, zone text, language text default 'en')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_person_id() is null then
    raise exception 'not_member';
  end if;
  if hour is not null and (hour < 0 or hour > 23) then
    raise exception 'bad_hour';
  end if;
  update public.people
    set evening_hour = hour, tz = left(coalesce(zone, tz), 64), lang = case when language = 'pt' then 'pt' else 'en' end
    where id = public.my_person_id();
end;
$$;
revoke all on function public.set_evening(smallint, text, text) from public;
grant execute on function public.set_evening(smallint, text, text) to authenticated;

-- Every hour, on the hour: the server function finds who's at their chosen hour right now
do $$
begin
  perform cron.unschedule('pititi-evening') where exists (select 1 from cron.job where jobname = 'pititi-evening');
  perform cron.schedule('pititi-evening', '0 * * * *', $job$ select public.pititi_call('{"type":"evening"}'::jsonb) $job$);
end $$;

-- Self-test: the columns, the function and the hourly job exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'people' and column_name = 'evening_hour') then
    raise exception 'Self-test FAILED: people.evening_hour missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'set_evening') then
    raise exception 'Self-test FAILED: set_evening missing';
  end if;
  if not exists (select 1 from cron.job where jobname = 'pititi-evening') then
    raise exception 'Self-test FAILED: hourly job missing';
  end if;
end $$;

select 'evening reminder ready' as status,
  (select schedule from cron.job where jobname = 'pititi-evening') as runs;
