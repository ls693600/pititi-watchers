-- Pititi Watchers 018: "Decide together" (swipe match). Someone in a household starts a movie night with ~15 titles;
-- each person swipes yes/no on their own phone; the first title everyone said yes to wins.
-- Fair play, enforced by the server: you only see someone else's vote on a title after you voted on it yourself.
-- Starting one notifies the rest of the household. Household only.
-- Run in Supabase > SQL Editor BEFORE deploying the app version that uses it (then the notify function is redeployed).

create table if not exists public.movie_nights (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade default public.my_household_id(),
  created_by uuid references public.people (id) on delete set null default public.my_person_id(),
  -- The posters to swipe, in order: [{kind, extId, title, poster, year, genres, runtime, network, score, because}]
  titles jsonb not null check (jsonb_typeof(titles) = 'array' and jsonb_array_length(titles) between 2 and 40),
  created_at timestamptz not null default now()
);
create index if not exists movie_nights_household_idx on public.movie_nights (household_id, created_at desc);

create table if not exists public.movie_night_votes (
  night_id uuid not null references public.movie_nights (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  -- "movie:693134" / "tv:44933"
  ref text not null check (ref ~ '^(movie|tv):[0-9]+$'),
  yes boolean not null,
  created_at timestamptz not null default now(),
  primary key (night_id, person_id, ref)
);

alter table public.movie_nights enable row level security;
alter table public.movie_night_votes enable row level security;

drop policy if exists "household reads its movie nights" on public.movie_nights;
drop policy if exists "household starts movie nights" on public.movie_nights;
drop policy if exists "starter removes a movie night" on public.movie_nights;
create policy "household reads its movie nights" on public.movie_nights
  for select to authenticated using (public.is_editor() and household_id = public.my_household_id());
create policy "household starts movie nights" on public.movie_nights
  for insert to authenticated with check (public.is_editor() and household_id = public.my_household_id() and created_by = public.my_person_id());
create policy "starter removes a movie night" on public.movie_nights
  for delete to authenticated using (household_id = public.my_household_id() and (created_by = public.my_person_id() or public.is_admin()));

-- Did I already vote on this title? (security definer: reads my own votes without recursing into the policy)
create or replace function public.voted_on(night uuid, title_ref text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.movie_night_votes v where v.night_id = night and v.ref = title_ref and v.person_id = public.my_person_id()) $$;
revoke all on function public.voted_on(uuid, text) from public;
grant execute on function public.voted_on(uuid, text) to authenticated;

drop policy if exists "see votes after you voted" on public.movie_night_votes;
drop policy if exists "vote as yourself" on public.movie_night_votes;
drop policy if exists "change your vote" on public.movie_night_votes;
create policy "see votes after you voted" on public.movie_night_votes
  for select to authenticated using (
    exists (select 1 from public.movie_nights n where n.id = night_id and n.household_id = public.my_household_id())
    and (person_id = public.my_person_id() or public.voted_on(night_id, ref))
  );
create policy "vote as yourself" on public.movie_night_votes
  for insert to authenticated with check (
    person_id = public.my_person_id() and public.is_editor()
    and exists (select 1 from public.movie_nights n where n.id = night_id and n.household_id = public.my_household_id())
  );
create policy "change your vote" on public.movie_night_votes
  for update to authenticated using (person_id = public.my_person_id()) with check (person_id = public.my_person_id());

-- Starting a movie night tells the rest of the household (uses pititi_call from 007)
create or replace function public.pititi_on_movie_night()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pititi_call(jsonb_build_object('type', 'movienight', 'id', new.id));
  return new;
end;
$$;
drop trigger if exists pititi_notify_movie_night on public.movie_nights;
create trigger pititi_notify_movie_night after insert on public.movie_nights
  for each row execute function public.pititi_on_movie_night();

do $$
declare
  t text;
begin
  foreach t in array array['movie_nights', 'movie_night_votes'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Self-test, rolled back: starting a night (which runs the notify trigger) works
do $$
declare
  home uuid;
begin
  select id into home from public.households limit 1;
  if home is null then
    return;
  end if;
  insert into public.movie_nights (id, household_id, created_by, titles)
    values (gen_random_uuid(), home, null, '[{"kind":"movie","extId":1},{"kind":"movie","extId":2}]'::jsonb);
  raise exception 'selftest_rollback';
exception
  when others then
    if sqlerrm <> 'selftest_rollback' then
      raise exception 'Movie night self-test FAILED: %', sqlerrm;
    end if;
end $$;

select 'movie night ready' as status, (select count(*) from public.movie_nights) as nights;
