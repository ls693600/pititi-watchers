-- Pititi Watchers 021: nothing gets lost.
--   * Removing a log keeps it (hidden) for 30 days, so Undo brings it back with everyone's chat, reactions and photos.
--     Removed logs disappear for everyone right away; after 30 days they're deleted for good.
--   * Merging two logs moves the chat, reactions and photos of the removed copy onto the one you keep.
--   * A log's "last changed" time comes from the server, not from each phone's clock.
--   * Ratings can only be given for people of the log's household.
-- Run in Supabase > SQL Editor BEFORE deploying the app version that uses it (then the notify function is redeployed).
-- Safe to run more than once.

alter table public.watches add column if not exists deleted_at timestamptz;
create index if not exists watches_deleted_idx on public.watches (deleted_at) where deleted_at is not null;

-- Removed logs are hidden from everyone (their chat, reactions and photos follow, since those check the log)
drop policy if exists "members read watches" on public.watches;
create policy "members read watches" on public.watches
  for select to authenticated using (deleted_at is null and public.can_see_household(household_id));

-- A prediction never opens on a removed log
create or replace function public.prediction_open(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.predictions pr
    join public.watches w on w.household_id = pr.household_id and w.show_id = pr.show_id and w.kind = 'tv' and w.deleted_at is null
    where pr.id = p
      and (w.season > pr.season or (w.season = pr.season and (w.episodes_watched >= pr.episode or w.status = 'done')))
  )
$$;

-- Same rule as deleting before: the admin, or the person who added it, in that household
create or replace function public.pititi_can_remove(log uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_editor() and exists (
    select 1 from public.watches w
    where w.id = log and w.household_id = public.my_household_id() and (public.is_admin() or w.created_by = public.my_person_id())
  )
$$;
revoke all on function public.pititi_can_remove(uuid) from public, anon;

create or replace function public.remove_log(log uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pititi_can_remove(log) then
    raise exception 'not_allowed';
  end if;
  -- Already removed: nothing to do (sending it twice is fine)
  update public.watches set deleted_at = now() where id = log and deleted_at is null;
end;
$$;

create or replace function public.restore_log(log uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pititi_can_remove(log) then
    raise exception 'not_allowed';
  end if;
  update public.watches set deleted_at = null where id = log;
end;
$$;

-- Merge: the removed copy's chat, reactions and photos move to the log you keep, then the copy is removed
create or replace function public.merge_logs(keep uuid, drop_log uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if keep = drop_log or not public.pititi_can_remove(drop_log)
     or not exists (
       select 1 from public.watches a join public.watches b on b.id = drop_log
       where a.id = keep and a.deleted_at is null and a.household_id = b.household_id
         and a.kind = b.kind and a.show_id = b.show_id
     ) then
    raise exception 'not_allowed';
  end if;
  update public.comments set watch_id = keep where watch_id = drop_log;
  update public.couch_photos set watch_id = keep where watch_id = drop_log;
  -- A reaction already given on the kept log wins; the duplicate stays with the removed copy
  update public.reactions r set watch_id = keep
    where r.watch_id = drop_log
      and not exists (select 1 from public.reactions k where k.watch_id = keep and k.person_id = r.person_id and k.target_id = r.target_id);
  update public.watches set deleted_at = now() where id = drop_log and deleted_at is null;
end;
$$;

revoke all on function public.remove_log(uuid) from public, anon;
revoke all on function public.restore_log(uuid) from public, anon;
revoke all on function public.merge_logs(uuid, uuid) from public, anon;
grant execute on function public.remove_log(uuid) to authenticated;
grant execute on function public.restore_log(uuid) to authenticated;
grant execute on function public.merge_logs(uuid, uuid) to authenticated;

-- "Last changed" is the server's clock
create or replace function public.pititi_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists watches_touch on public.watches;
create trigger watches_touch before update on public.watches
  for each row when (old.deleted_at is not distinct from new.deleted_at)
  execute function public.pititi_touch();

-- Ratings: only on your household's logs (as before), and only for people of that household
drop policy if exists "editors change ratings" on public.ratings;
create policy "editors change ratings" on public.ratings
  for all to authenticated
  using (public.is_editor() and exists (select 1 from public.watches w where w.id = watch_id and w.household_id = public.my_household_id()))
  with check (
    public.is_editor()
    and exists (select 1 from public.watches w where w.id = watch_id and w.household_id = public.my_household_id())
    and exists (select 1 from public.people p where p.id = person_id and p.household_id = public.my_household_id())
  );

-- After 30 days, removed logs are deleted for good (with their chat, reactions and photos rows)
do $$
begin
  perform cron.unschedule('pititi-purge') where exists (select 1 from cron.job where jobname = 'pititi-purge');
  perform cron.schedule('pititi-purge', '15 4 * * *', $job$ delete from public.watches where deleted_at < now() - interval '30 days' $job$);
end $$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'pititi-purge') then
    raise exception 'Safe saves self-test FAILED: the daily clean-up job is missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'merge_logs') then
    raise exception 'Safe saves self-test FAILED: merge_logs missing';
  end if;
end $$;

select 'safe saves ready' as status,
  (select count(*) from public.watches where deleted_at is null) as logs,
  (select count(*) from public.ratings) as ratings,
  (select count(*) from public.comments) as messages;
