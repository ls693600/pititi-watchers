-- Pititi Watchers 017: predictions. Before an episode, each person in a household seals a guess ("Who is the killer?").
-- Guesses stay sealed (the SERVER hides them, not just the app) until that household logs the episode; then everyone
-- in the household sees them and marks each one right or wrong. Only your household sees its predictions.
-- Run in Supabase > SQL Editor BEFORE deploying the app version that uses it. Safe to run more than once.

create table if not exists public.predictions (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade default public.my_household_id(),
  show_id integer not null,
  season integer not null check (season >= 1),
  -- The episode that opens the guesses
  episode integer not null check (episode >= 1),
  question text not null default '' check (char_length(question) <= 140),
  created_by uuid references public.people (id) on delete set null default public.my_person_id(),
  created_at timestamptz not null default now()
);
create index if not exists predictions_show_idx on public.predictions (household_id, show_id, season);

create table if not exists public.prediction_guesses (
  prediction_id uuid not null references public.predictions (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  guess text not null check (char_length(btrim(guess)) between 1 and 200),
  -- Set after the reveal by anyone in the household: right / wrong
  verdict text check (verdict in ('right', 'wrong')),
  created_at timestamptz not null default now(),
  primary key (prediction_id, person_id)
);

-- Has this household logged the episode that opens the prediction? (a later season counts too)
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
    join public.watches w on w.household_id = pr.household_id and w.show_id = pr.show_id and w.kind = 'tv'
    where pr.id = p
      and (w.season > pr.season or (w.season = pr.season and (w.episodes_watched >= pr.episode or w.status = 'done')))
  )
$$;
revoke all on function public.prediction_open(uuid) from public;
grant execute on function public.prediction_open(uuid) to authenticated;

alter table public.predictions enable row level security;
alter table public.prediction_guesses enable row level security;

drop policy if exists "household reads its predictions" on public.predictions;
drop policy if exists "household adds predictions" on public.predictions;
drop policy if exists "author or admin removes predictions" on public.predictions;
create policy "household reads its predictions" on public.predictions
  for select to authenticated using (public.is_editor() and household_id = public.my_household_id());
create policy "household adds predictions" on public.predictions
  for insert to authenticated with check (public.is_editor() and household_id = public.my_household_id() and created_by = public.my_person_id());
create policy "author or admin removes predictions" on public.predictions
  for delete to authenticated using (household_id = public.my_household_id() and (created_by = public.my_person_id() or public.is_admin()));

-- Your own guess always; the others' only once the episode is logged
drop policy if exists "sealed until the episode" on public.prediction_guesses;
drop policy if exists "guess as yourself before the reveal" on public.prediction_guesses;
drop policy if exists "change your guess before the reveal" on public.prediction_guesses;
create policy "sealed until the episode" on public.prediction_guesses
  for select to authenticated using (
    exists (select 1 from public.predictions pr where pr.id = prediction_id and pr.household_id = public.my_household_id())
    and (person_id = public.my_person_id() or public.prediction_open(prediction_id))
  );
create policy "guess as yourself before the reveal" on public.prediction_guesses
  for insert to authenticated with check (
    person_id = public.my_person_id() and verdict is null and not public.prediction_open(prediction_id)
    and exists (select 1 from public.predictions pr where pr.id = prediction_id and pr.household_id = public.my_household_id())
  );
create policy "change your guess before the reveal" on public.prediction_guesses
  for update to authenticated using (person_id = public.my_person_id() and not public.prediction_open(prediction_id))
  with check (person_id = public.my_person_id() and verdict is null and not public.prediction_open(prediction_id));

-- After the reveal, anyone in the household marks a guess right or wrong (only the verdict changes)
create or replace function public.judge_guess(prediction uuid, person uuid, result text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if result is not null and result not in ('right', 'wrong') then
    raise exception 'verdict_invalid';
  end if;
  if not exists (select 1 from public.predictions pr where pr.id = prediction and pr.household_id = public.my_household_id())
     or not public.is_editor() then
    raise exception 'not_your_household';
  end if;
  if not public.prediction_open(prediction) then
    raise exception 'still_sealed';
  end if;
  update public.prediction_guesses set verdict = result where prediction_id = prediction and person_id = person;
end;
$$;
revoke all on function public.judge_guess(uuid, uuid, text) from public;
grant execute on function public.judge_guess(uuid, uuid, text) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['predictions', 'prediction_guesses'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select 'predictions ready' as status, (select count(*) from public.predictions) as predictions;
