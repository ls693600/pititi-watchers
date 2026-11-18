-- Pititi Watchers 020: a log's watchers are always people of that log's household.
-- Bug: some logs listed someone from ANOTHER household (an old merge with another family's copy of the same show, or a
-- person later moved to another household) or someone who was removed. The app showed "X isn't in your household",
-- and worse, the household average and rating reveal waited forever for that person's rating.
-- This repairs every log once, and from now on the database keeps it clean by itself:
--   * saving a log drops watchers who aren't in its household (or no longer exist)
--   * moving a person to another household takes them off the old household's logs
--   * removing a person takes them off every log
-- Ratings left by someone who is no longer a watcher of that log are removed too (they were already not counted).
-- Logs, progress, other ratings and dates are not touched. Safe to run more than once.

-- The watchers that belong on a log of this household (same order as before)
create or replace function public.pititi_household_watchers(ids uuid[], home uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when home is null then ids
    else coalesce((
      select array_agg(x.id order by x.ord)
      from unnest(ids) with ordinality as x (id, ord)
      where exists (select 1 from public.people p where p.id = x.id and p.household_id = home)
    ), '{}')
  end
$$;
revoke all on function public.pititi_household_watchers(uuid[], uuid) from public, anon, authenticated;

-- Every save of a log (from any app version, including offline changes sent later)
create or replace function public.pititi_watchers_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.watched_by := public.pititi_household_watchers(coalesce(new.watched_by, '{}'), new.household_id);
  return new;
end;
$$;
drop trigger if exists watches_household_watchers on public.watches;
create trigger watches_household_watchers before insert or update of watched_by, household_id on public.watches
  for each row execute function public.pititi_watchers_guard();

-- Ratings on a log by people who aren't its watchers (only when the log has watchers; a log with none counts every rating)
create or replace function public.pititi_drop_stray_ratings(log uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ratings r
  using public.watches w
  where w.id = log and r.watch_id = w.id and cardinality(w.watched_by) > 0 and not (r.person_id = any (w.watched_by))
$$;
revoke all on function public.pititi_drop_stray_ratings(uuid) from public, anon, authenticated;

create or replace function public.pititi_watchers_ratings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.watched_by is distinct from old.watched_by then
    perform public.pititi_drop_stray_ratings(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists watches_stray_ratings on public.watches;
create trigger watches_stray_ratings after update of watched_by, household_id on public.watches
  for each row execute function public.pititi_watchers_ratings();

-- A person moves to another household (or is removed): off the logs of the household they left
create or replace function public.pititi_person_left()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.watches w set watched_by = array_remove(w.watched_by, old.id) where old.id = any (w.watched_by);
  else
    update public.watches w set watched_by = array_remove(w.watched_by, old.id)
      where old.id = any (w.watched_by) and w.household_id is distinct from new.household_id;
  end if;
  return null;
end;
$$;
drop trigger if exists people_left_household on public.people;
create trigger people_left_household after update of household_id on public.people
  for each row when (old.household_id is distinct from new.household_id)
  execute function public.pititi_person_left();
drop trigger if exists people_removed on public.people;
create trigger people_removed after delete on public.people
  for each row execute function public.pititi_person_left();

-- One-time repair of every log, reported before and after
do $$
declare
  logs integer;
  people_off integer;
begin
  select count(*), coalesce(sum(cardinality(w.watched_by) - cardinality(public.pititi_household_watchers(w.watched_by, w.household_id))), 0)
    into logs, people_off
    from public.watches w
    where w.watched_by is distinct from public.pititi_household_watchers(w.watched_by, w.household_id);
  -- The guard trigger does the cleaning; the ratings trigger then removes ratings that no longer count
  update public.watches w set watched_by = w.watched_by
    where w.watched_by is distinct from public.pititi_household_watchers(w.watched_by, w.household_id);
  -- Ratings that were already not counted (by someone who isn't a watcher of that log)
  delete from public.ratings r using public.watches w
    where r.watch_id = w.id and cardinality(w.watched_by) > 0 and not (r.person_id = any (w.watched_by));
  raise notice 'Repaired % logs (% watchers removed)', logs, people_off;
  if exists (select 1 from public.watches w where w.watched_by is distinct from public.pititi_household_watchers(w.watched_by, w.household_id)) then
    raise exception 'Repair self-test FAILED: some logs still list people from another household';
  end if;
end $$;

select 'watchers fixed' as status,
  (select count(*) from public.watches w
     where exists (select 1 from unnest(w.watched_by) x (id) join public.people p on p.id = x.id
                   where w.household_id is not null and p.household_id is distinct from w.household_id)) as logs_still_wrong,
  (select count(*) from public.watches) as logs;
