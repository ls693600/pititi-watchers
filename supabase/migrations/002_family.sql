-- Pititi Watchers 002: family members.
-- Replaces the fixed two-seat model (members p1/p2, rating_p1/rating_p2) with:
--   people   – profiles (a family member); may or may not have a login yet
--   ratings  – one row per person per log
--   watches.watched_by – who watched it
--   household.invite_code – needed to create an account
-- Keeps every existing account, log and rating. Safe to run once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

-- People ---------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.household (
  id smallint primary key default 1 check (id = 1),
  invite_code text not null
);

insert into public.household (id, invite_code)
values (1, upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)))
on conflict (id) do nothing;

-- Carry Leandro (p1) and Ana (p2) over, with their accounts if they exist
insert into public.people (name, user_id)
select 'Leandro', (select user_id from public.members where person = 'p1')
where not exists (select 1 from public.people where name = 'Leandro');

insert into public.people (name, user_id)
select 'Ana', (select user_id from public.members where person = 'p2')
where not exists (select 1 from public.people where name = 'Ana');

-- Ratings ------------------------------------------------------------------
create table if not exists public.ratings (
  watch_id uuid not null references public.watches (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (watch_id, person_id)
);

alter table public.watches add column if not exists watched_by uuid[] not null default '{}';

do $$
declare
  leandro uuid := (select id from public.people where name = 'Leandro' limit 1);
  ana uuid := (select id from public.people where name = 'Ana' limit 1);
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'watches' and column_name = 'rating_p1') then
    insert into public.ratings (watch_id, person_id, stars)
      select id, leandro, rating_p1 from public.watches where rating_p1 is not null
      on conflict do nothing;
    insert into public.ratings (watch_id, person_id, stars)
      select id, ana, rating_p2 from public.watches where rating_p2 is not null
      on conflict do nothing;
    -- Everything logged so far was watched together
    update public.watches set watched_by = array[leandro, ana] where watched_by = '{}';
    alter table public.watches drop column rating_p1;
    alter table public.watches drop column rating_p2;
  end if;
end $$;

-- Retire the two-seat model
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.claim_household_seat();
drop function if exists public.taken_seats();

-- Access -------------------------------------------------------------------
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.people where user_id = auth.uid()) $$;

alter table public.people enable row level security;
alter table public.household enable row level security;
alter table public.ratings enable row level security;

drop policy if exists "household reads watches" on public.watches;
drop policy if exists "household writes watches" on public.watches;
drop policy if exists "members use watches" on public.watches;
create policy "members use watches" on public.watches
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members use ratings" on public.ratings;
create policy "members use ratings" on public.ratings
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members read people" on public.people;
create policy "members read people" on public.people
  for select to authenticated using (public.is_member());

-- Members add profiles (e.g. a child without a phone) but never link logins; sign-up does that
drop policy if exists "members add people" on public.people;
create policy "members add people" on public.people
  for insert to authenticated with check (public.is_member() and user_id is null);

drop policy if exists "members rename people" on public.people;
create policy "members rename people" on public.people
  for update to authenticated using (public.is_member()) with check (public.is_member());

-- Stop members from re-pointing someone else's login at a profile
create or replace function public.people_keep_login()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id and current_user = 'authenticated' then
    raise exception 'login_locked';
  end if;
  return new;
end;
$$;
drop trigger if exists people_keep_login on public.people;
create trigger people_keep_login before update on public.people
  for each row execute function public.people_keep_login();

drop policy if exists "members read household" on public.household;
create policy "members read household" on public.household
  for select to authenticated using (public.is_member());

drop policy if exists "members renew invite" on public.household;
create policy "members renew invite" on public.household
  for update to authenticated using (public.is_member()) with check (public.is_member());

-- Joining ------------------------------------------------------------------
-- Sign-up sends invite_code plus either person_id (claim an existing profile) or name (new profile).
create or replace function public.join_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  claim uuid := nullif(new.raw_user_meta_data ->> 'person_id', '')::uuid;
  new_name text := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
begin
  if not exists (select 1 from public.household where invite_code = code) then
    raise exception 'invite_invalid';
  end if;
  if claim is not null then
    update public.people set user_id = new.id where id = claim and user_id is null;
    if not found then
      raise exception 'profile_taken';
    end if;
  elsif char_length(new_name) between 1 and 30 then
    insert into public.people (name, user_id) values (new_name, new.id);
  else
    raise exception 'name_required';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_joined on auth.users;
create trigger on_auth_user_joined
  after insert on auth.users
  for each row execute function public.join_household();

-- Sign-up screen: which profiles can still be claimed. Returns nothing for a wrong code.
create or replace function public.open_profiles(code text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name from public.people p
  where p.user_id is null
    and exists (select 1 from public.household h where h.invite_code = upper(btrim(code)))
  order by p.created_at
$$;

create or replace function public.invite_valid(code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.household where invite_code = upper(btrim(code))) $$;

revoke all on function public.open_profiles(text) from public;
revoke all on function public.invite_valid(text) from public;
grant execute on function public.open_profiles(text) to anon, authenticated;
grant execute on function public.invite_valid(text) to anon, authenticated;

drop table if exists public.members;

-- Live sync for the new tables
do $$
declare t text;
begin
  foreach t in array array['ratings', 'people'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
