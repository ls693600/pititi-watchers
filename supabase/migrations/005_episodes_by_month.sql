-- Pititi Watchers 005: count episodes in the month they were watched.
-- A show watched across several months now counts in each of them.
-- Run once in Supabase > SQL Editor before deploying the matching app version.

alter table public.watches
  add column if not exists episodes_by_month jsonb not null default '{}'::jsonb;

-- Existing logs: everything counts in the month they're filed under (same as before)
update public.watches
  set episodes_by_month = jsonb_build_object(month, episodes_watched)
  where episodes_by_month = '{}'::jsonb and episodes_watched > 0;

select show_name, season, month, episodes_watched, episodes_by_month from public.watches order by updated_at desc limit 10;
