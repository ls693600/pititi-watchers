-- Pititi Watchers 019: watch parties across households. One household plans a party (a show episode or a movie, now or
-- at a time) and invites other households in the family. Each person says Join / Can't make it. When it starts, the
-- server sets the moment everyone presses play (a shared 3-2-1); anyone who joined can pause and resume for everyone.
-- A party chat (text + quick reactions) lives with the party and stays readable on the show's page afterwards.
-- Only the host household and the invited households see a party. Parties that never start close 3 hours after the
-- planned time; parties left running close 4 hours after the last play/pause.
-- Run in Supabase > SQL Editor BEFORE deploying the app version that uses it (then the notify function is redeployed).
-- Safe to run more than once.

create table if not exists public.watch_parties (
  id uuid primary key,
  host_household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.people (id) on delete set null,
  kind text not null check (kind in ('tv', 'movie')),
  -- TVmaze show id for tv, TMDB id for movies (same as list_items.ext_id)
  ext_id integer not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  poster text check (char_length(poster) <= 500),
  season integer check (season >= 1),
  episode integer check (episode >= 1),
  runtime integer check (runtime between 1 and 600),
  -- The planned start
  starts_at timestamptz not null,
  state text not null default 'planned' check (state in ('planned', 'playing', 'paused', 'ended', 'cancelled')),
  -- While playing: the moment the 3-2-1 hits 0 (everyone presses play then); position_sec is where it starts from
  play_at timestamptz,
  position_sec integer not null default 0 check (position_sec >= 0),
  -- Who paused last (shown as "Fernando paused at 18:32")
  paused_by uuid references public.people (id) on delete set null,
  reminded_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((kind = 'tv') = (season is not null and episode is not null))
);
create index if not exists watch_parties_host_idx on public.watch_parties (host_household_id, starts_at desc);
create index if not exists watch_parties_open_idx on public.watch_parties (state, starts_at) where state in ('planned', 'playing', 'paused');
create index if not exists watch_parties_show_idx on public.watch_parties (kind, ext_id);

-- The invited households (the host household is on the party itself)
create table if not exists public.watch_party_guests (
  party_id uuid not null references public.watch_parties (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  primary key (party_id, household_id)
);
create index if not exists watch_party_guests_household_idx on public.watch_party_guests (household_id);

-- Each person's answer
create table if not exists public.watch_party_people (
  party_id uuid not null references public.watch_parties (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  answer text not null check (answer in ('join', 'no')),
  updated_at timestamptz not null default now(),
  primary key (party_id, person_id)
);

create table if not exists public.watch_party_messages (
  id uuid primary key,
  party_id uuid not null references public.watch_parties (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  kind text not null default 'text' check (kind in ('text', 'react')),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  -- Where in the episode it was said (seconds), when known
  at_sec integer check (at_sec >= 0),
  created_at timestamptz not null default now(),
  check (kind = 'text' or body in ('😱', '😂', '😭', '🔥', '❤️'))
);
create index if not exists watch_party_messages_party_idx on public.watch_party_messages (party_id, created_at);

-- Is my household the host or invited? (security definer: no recursion into the policies)
create or replace function public.in_party(party uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_editor() and exists (
    select 1 from public.watch_parties p
    where p.id = party
      and (p.host_household_id = public.my_household_id()
        or exists (select 1 from public.watch_party_guests g where g.party_id = p.id and g.household_id = public.my_household_id()))
  )
$$;
revoke all on function public.in_party(uuid) from public;
grant execute on function public.in_party(uuid) to authenticated;

alter table public.watch_parties enable row level security;
alter table public.watch_party_guests enable row level security;
alter table public.watch_party_people enable row level security;
alter table public.watch_party_messages enable row level security;

-- Reading: only the households in the party. Writing parties and guests: only through the functions below.
drop policy if exists "party households read the party" on public.watch_parties;
create policy "party households read the party" on public.watch_parties
  for select to authenticated using (public.in_party(id));
drop policy if exists "party households read the guest list" on public.watch_party_guests;
create policy "party households read the guest list" on public.watch_party_guests
  for select to authenticated using (public.in_party(party_id));

drop policy if exists "party households read answers" on public.watch_party_people;
drop policy if exists "answer for yourself" on public.watch_party_people;
drop policy if exists "change your answer" on public.watch_party_people;
create policy "party households read answers" on public.watch_party_people
  for select to authenticated using (public.in_party(party_id));
create policy "answer for yourself" on public.watch_party_people
  for insert to authenticated with check (
    person_id = public.my_person_id() and public.in_party(party_id)
    and exists (select 1 from public.watch_parties p where p.id = party_id and p.state in ('planned', 'playing', 'paused'))
  );
create policy "change your answer" on public.watch_party_people
  for update to authenticated using (person_id = public.my_person_id())
  with check (
    person_id = public.my_person_id() and public.in_party(party_id)
    and exists (select 1 from public.watch_parties p where p.id = party_id and p.state in ('planned', 'playing', 'paused'))
  );

drop policy if exists "party households read the chat" on public.watch_party_messages;
drop policy if exists "chat as yourself while the party is on" on public.watch_party_messages;
drop policy if exists "remove your own message" on public.watch_party_messages;
create policy "party households read the chat" on public.watch_party_messages
  for select to authenticated using (public.in_party(party_id));
create policy "chat as yourself while the party is on" on public.watch_party_messages
  for insert to authenticated with check (
    person_id = public.my_person_id() and public.in_party(party_id)
    and exists (select 1 from public.watch_parties p where p.id = party_id and p.state in ('planned', 'playing', 'paused'))
  );
create policy "remove your own message" on public.watch_party_messages
  for delete to authenticated using (person_id = public.my_person_id() or public.is_admin());

-- Plan a party and invite households, in one step; the invited households get a notification
create or replace function public.create_watch_party(
  party uuid, guest_households uuid[], party_kind text, party_ext_id integer, party_title text,
  party_poster text, party_season integer, party_episode integer, party_runtime integer, party_starts_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  home uuid := public.my_household_id();
  guests uuid[];
begin
  if not public.is_editor() or home is null then
    raise exception 'not_in_a_household';
  end if;
  select coalesce(array_agg(distinct g), '{}') into guests
    from unnest(coalesce(guest_households, '{}')) g where g <> home;
  if cardinality(guests) = 0 then
    raise exception 'no_guests';
  end if;
  if (select count(*) from public.households h where h.id = any (guests)) <> cardinality(guests) then
    raise exception 'unknown_household';
  end if;
  if party_starts_at < now() - interval '5 minutes' or party_starts_at > now() + interval '30 days' then
    raise exception 'bad_start';
  end if;
  insert into public.watch_parties (id, host_household_id, created_by, kind, ext_id, title, poster, season, episode, runtime, starts_at)
    values (party, home, public.my_person_id(), party_kind, party_ext_id, btrim(party_title), party_poster,
      party_season, party_episode, party_runtime, greatest(party_starts_at, now()));
  insert into public.watch_party_guests (party_id, household_id) select party, g from unnest(guests) g;
  -- The host is in
  insert into public.watch_party_people (party_id, person_id, answer) values (party, public.my_person_id(), 'join');
  perform public.pititi_call(jsonb_build_object('type', 'party', 'stage', 'invite', 'id', party));
end;
$$;
revoke all on function public.create_watch_party(uuid, uuid[], text, integer, text, text, integer, integer, integer, timestamptz) from public;
grant execute on function public.create_watch_party(uuid, uuid[], text, integer, text, text, integer, integer, integer, timestamptz) to authenticated;

-- Start / pause / resume / end / cancel. Returns the party plus the server clock, so every phone counts down from the
-- same moment even when the phones' clocks disagree.
--   start, resume: anyone who said Join (the host household can always start)
--   pause: anyone who said Join
--   end, cancel: the host household
create or replace function public.party_control(party uuid, action text, at_sec integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.watch_parties;
  me uuid := public.my_person_id();
  host boolean;
  joined boolean;
  countdown constant interval := interval '4 seconds';
begin
  if not public.in_party(party) then
    raise exception 'not_your_party';
  end if;
  select * into p from public.watch_parties where id = party for update;
  host := p.host_household_id = public.my_household_id();
  joined := exists (select 1 from public.watch_party_people w where w.party_id = party and w.person_id = me and w.answer = 'join');
  if p.state in ('ended', 'cancelled') then
    raise exception 'party_over';
  end if;

  if action = 'start' then
    if p.state <> 'planned' then raise exception 'already_started'; end if;
    if not (host or joined) then raise exception 'join_first'; end if;
    update public.watch_parties set state = 'playing', play_at = now() + countdown, position_sec = 0, paused_by = null, updated_at = now()
      where id = party returning * into p;
    perform public.pititi_call(jsonb_build_object('type', 'party', 'stage', 'start', 'id', party));
  elsif action = 'pause' then
    if p.state <> 'playing' then raise exception 'not_playing'; end if;
    if not joined then raise exception 'join_first'; end if;
    update public.watch_parties
      set state = 'paused',
        -- Where everyone is now (the phone's own number if it sent one, otherwise the server's)
        position_sec = coalesce(at_sec, p.position_sec + greatest(0, extract(epoch from now() - p.play_at))::integer),
        paused_by = me, play_at = null, updated_at = now()
      where id = party returning * into p;
  elsif action = 'resume' then
    if p.state <> 'paused' then raise exception 'not_paused'; end if;
    if not joined then raise exception 'join_first'; end if;
    update public.watch_parties set state = 'playing', play_at = now() + countdown, updated_at = now()
      where id = party returning * into p;
  elsif action in ('end', 'cancel') then
    if not host then raise exception 'host_only'; end if;
    update public.watch_parties set state = case when action = 'cancel' or p.state = 'planned' then 'cancelled' else 'ended' end,
      play_at = null, updated_at = now()
      where id = party returning * into p;
    if p.state = 'cancelled' then
      perform public.pititi_call(jsonb_build_object('type', 'party', 'stage', 'cancel', 'id', party));
    end if;
  else
    raise exception 'bad_action';
  end if;

  return to_jsonb(p) || jsonb_build_object('server_now', now());
end;
$$;
revoke all on function public.party_control(uuid, text, integer) from public;
grant execute on function public.party_control(uuid, text, integer) to authenticated;

-- The server clock, for phones that open a party already playing
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now() $$;
grant execute on function public.server_now() to authenticated;

-- Every 5 minutes: the 15-minute reminder, and closing parties nobody is using
create or replace function public.pititi_party_tick()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    update public.watch_parties set reminded_at = now()
    where state = 'planned' and reminded_at is null and starts_at <= now() + interval '15 minutes' and starts_at > now() - interval '5 minutes'
    returning id
  loop
    perform public.pititi_call(jsonb_build_object('type', 'party', 'stage', 'soon', 'id', r.id));
    n := n + 1;
  end loop;
  update public.watch_parties set state = 'cancelled', updated_at = now()
    where state = 'planned' and starts_at < now() - interval '3 hours';
  update public.watch_parties set state = 'ended', play_at = null, updated_at = now()
    where state in ('playing', 'paused') and updated_at < now() - interval '4 hours';
  return n;
end;
$$;
revoke all on function public.pititi_party_tick() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('pititi-party') where exists (select 1 from cron.job where jobname = 'pititi-party');
  perform cron.schedule('pititi-party', '*/5 * * * *', $job$ select public.pititi_party_tick() $job$);
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['watch_parties', 'watch_party_guests', 'watch_party_people', 'watch_party_messages'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Self-test, rolled back: a party row with a guest saves, the tick runs, and the job is scheduled
do $$
declare
  a uuid;
  b uuid;
  pid uuid := gen_random_uuid();
begin
  if not exists (select 1 from cron.job where jobname = 'pititi-party') then
    raise exception 'Watch party self-test FAILED: the 5-minute job is missing';
  end if;
  select id into a from public.households order by created_at limit 1;
  select id into b from public.households where id <> a order by created_at limit 1;
  if a is not null and b is not null then
    insert into public.watch_parties (id, host_household_id, kind, ext_id, title, season, episode, starts_at)
      values (pid, a, 'tv', 1, 'Self-test', 1, 1, now() + interval '10 minutes');
    insert into public.watch_party_guests (party_id, household_id) values (pid, b);
    perform public.pititi_party_tick();
  end if;
  raise exception 'selftest_rollback';
exception
  when others then
    if sqlerrm <> 'selftest_rollback' then
      raise exception 'Watch party self-test FAILED: %', sqlerrm;
    end if;
end $$;

select 'watch parties ready' as status,
  (select count(*) from public.households) as households,
  (select schedule from cron.job where jobname = 'pititi-party') as checks_every;
