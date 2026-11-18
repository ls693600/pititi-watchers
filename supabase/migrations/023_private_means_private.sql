-- Pititi Watchers 023: a household that keeps its log private keeps its couch photos and episode reactions private too.
-- Before: the whole family saw every couch photo and every episode emoji, even from a private household.
-- Now they follow the log: you see them if you can see that household's log (yours, or one that's shared).
-- Nothing is deleted; switching the household back to shared shows them again. Viewers' reactions stay visible.
-- Safe to run more than once.

-- Can I see this person's household? (viewers have no household: their reactions stay visible to the family)
create or replace function public.pititi_sees_person(person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member() and exists (
    select 1 from public.people p
    where p.id = person and (p.household_id is null or public.can_see_household(p.household_id))
  )
$$;
revoke all on function public.pititi_sees_person(uuid) from public, anon;
grant execute on function public.pititi_sees_person(uuid) to authenticated;

-- Photo files live in a folder named after the household
create or replace function public.pititi_sees_photo_file(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.is_member() and public.can_see_household(split_part(path, '/', 1)::uuid);
exception
  when invalid_text_representation then
    return false;
end;
$$;
revoke all on function public.pititi_sees_photo_file(text) from public, anon;
grant execute on function public.pititi_sees_photo_file(text) to authenticated;

drop policy if exists "family reads couch photos" on public.couch_photos;
create policy "family reads couch photos" on public.couch_photos
  for select to authenticated using (public.is_member() and exists (select 1 from public.watches w where w.id = watch_id));

drop policy if exists "family reads couch photo files" on storage.objects;
create policy "family reads couch photo files" on storage.objects
  for select to authenticated using (bucket_id = 'couch-photos' and public.pititi_sees_photo_file(name));

drop policy if exists "members read episode reactions" on public.episode_reactions;
create policy "members read episode reactions" on public.episode_reactions
  for select to authenticated using (public.pititi_sees_person(person_id));

select 'private means private' as status,
  (select count(*) from public.households where not share_log) as private_households;
