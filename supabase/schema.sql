-- CouchLog schema. Paste into Supabase > SQL Editor and run once.

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

-- Live sync between the two phones.
alter publication supabase_realtime add table public.watches;
