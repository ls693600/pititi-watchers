-- Pititi Watchers schema. Paste into Supabase > SQL Editor and run once.

-- Who belongs to the household. p1 = Leandro, p2 = Ana.
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  person text not null unique check (person in ('p1', 'p2'))
);

create table if not exists public.watches (
  id uuid primary key,
  show_id integer not null,
  show_name text not null,
  poster text,
  network text,
  genres text[] not null default '{}',
  year text,
  season integer not null check (season > 0),
  episodes_watched integer not null default 0 check (episodes_watched >= 0),
  total_episodes integer check (total_episodes is null or total_episodes >= 0),
  runtime integer,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null check (status in ('watching', 'done')),
  rating_p1 smallint check (rating_p1 between 1 and 5),
  rating_p2 smallint check (rating_p2 between 1 and 5),
  is_rewatch boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watches_month_idx on public.watches (month);

-- Only household members can see or change anything.
alter table public.members enable row level security;
alter table public.watches enable row level security;

-- Each user reads only their own membership row (a self-referencing policy would recurse).
drop policy if exists "members read own row" on public.members;
create policy "members read own row" on public.members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "household reads watches" on public.watches;
create policy "household reads watches" on public.watches
  for select to authenticated
  using (exists (select 1 from public.members m where m.user_id = auth.uid()));

drop policy if exists "household writes watches" on public.watches;
create policy "household writes watches" on public.watches
  for all to authenticated
  using (exists (select 1 from public.members m where m.user_id = auth.uid()))
  with check (exists (select 1 from public.members m where m.user_id = auth.uid()));

-- Sign-up claims a seat: the app sends person = p1 (Leandro) or p2 (Ana).
-- A third account, or a second account for the same person, is rejected and never created.
create or replace function public.claim_household_seat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text := new.raw_user_meta_data ->> 'person';
begin
  if wanted is null or wanted not in ('p1', 'p2') then
    raise exception 'seat_invalid';
  end if;
  if exists (select 1 from public.members where person = wanted) then
    raise exception 'seat_taken';
  end if;
  insert into public.members (user_id, person) values (new.id, wanted);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.claim_household_seat();

-- Lets the sign-up screen show which names are still free (returns only 'p1'/'p2').
create or replace function public.taken_seats()
returns setof text
language sql
security definer
set search_path = public
as $$ select person from public.members $$;

grant execute on function public.taken_seats() to anon, authenticated;

-- Live sync between the two phones.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watches'
  ) then
    alter publication supabase_realtime add table public.watches;
  end if;
end $$;
