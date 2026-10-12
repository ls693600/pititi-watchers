-- Pititi Watchers 008: households in a family circle, movies, lists with privacy, votes, recommendations.
-- Run once in Supabase > SQL Editor, BEFORE deploying the matching app version.
-- Keeps everything: the current family log becomes the household "Leandro & Ana".

-- Households -----------------------------------------------------------------
-- Each couple (or person) has its own log, stats and blind ratings. Together they form the family circle.
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Other households can see this household's watch log (feed, household page). Lists have their own privacy.
  share_log boolean not null default true,
  created_at timestamptz not null default now()
);

-- Invite codes live apart so only the household's own members (and the admin) can read them
create table if not exists public.household_invites (
  household_id uuid primary key references public.households (id) on delete cascade,
  code text not null unique
);

alter table public.people add column if not exists household_id uuid references public.households (id) on delete set null;
alter table public.watches add column if not exists household_id uuid references public.households (id) on delete cascade;
alter table public.watches add column if not exists kind text not null default 'tv' check (kind in ('tv', 'movie'));

-- First run: the existing family becomes household "Leandro & Ana", keeping its invite code
do $$
declare
  first_id uuid;
  old_code text;
begin
  if not exists (select 1 from public.households) then
    insert into public.households (name) values ('Leandro & Ana') returning id into first_id;
    select invite_code into old_code from public.household where id = 1;
    insert into public.household_invites (household_id, code)
      values (first_id, coalesce(old_code, upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))));
    update public.people set household_id = first_id where household_id is null and not is_viewer;
    update public.watches set household_id = first_id where household_id is null;
  end if;
end $$;

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select household_id from public.people where user_id = auth.uid() $$;
revoke all on function public.my_household_id() from public;
grant execute on function public.my_household_id() to authenticated;

alter table public.watches alter column household_id set default public.my_household_id();

alter table public.households enable row level security;
alter table public.household_invites enable row level security;

drop policy if exists "members read households" on public.households;
drop policy if exists "admin adds households" on public.households;
drop policy if exists "household or admin edits household" on public.households;
drop policy if exists "admin removes households" on public.households;
create policy "members read households" on public.households
  for select to authenticated using (public.is_member());
create policy "admin adds households" on public.households
  for insert to authenticated with check (public.is_admin());
create policy "household or admin edits household" on public.households
  for update to authenticated using (public.is_admin() or (public.is_editor() and id = public.my_household_id()))
  with check (public.is_admin() or (public.is_editor() and id = public.my_household_id()));
create policy "admin removes households" on public.households
  for delete to authenticated using (public.is_admin() and id <> public.my_household_id());

drop policy if exists "household reads its code" on public.household_invites;
drop policy if exists "admin manages codes" on public.household_invites;
drop policy if exists "household renews its code" on public.household_invites;
create policy "household reads its code" on public.household_invites
  for select to authenticated using (public.is_admin() or (public.is_editor() and household_id = public.my_household_id()));
create policy "admin manages codes" on public.household_invites
  for insert to authenticated with check (public.is_admin());
create policy "household renews its code" on public.household_invites
  for update to authenticated using (public.is_admin() or (public.is_editor() and household_id = public.my_household_id()))
  with check (public.is_admin() or (public.is_editor() and household_id = public.my_household_id()));

-- Admin adds people to any household (e.g. grandparents without a phone)
drop policy if exists "admin adds people" on public.people;
create policy "admin adds people" on public.people
  for insert to authenticated with check (public.is_admin() and user_id is null and not is_admin);

-- Only the admin moves people between households or changes roles
create or replace function public.people_keep_role()
returns trigger
language plpgsql
as $$
begin
  if (new.is_viewer is distinct from old.is_viewer
      or new.is_admin is distinct from old.is_admin
      or new.household_id is distinct from old.household_id)
     and current_user = 'authenticated' and not public.is_admin() then
    raise exception 'role_locked';
  end if;
  return new;
end;
$$;

-- Watches: your household writes its own log; others read it when the household shares its log
create or replace function public.can_see_household(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member() and (
    h = public.my_household_id()
    or exists (select 1 from public.households where id = h and share_log)
  )
$$;
revoke all on function public.can_see_household(uuid) from public;
grant execute on function public.can_see_household(uuid) to authenticated;

drop policy if exists "members read watches" on public.watches;
drop policy if exists "members add watches" on public.watches;
drop policy if exists "members edit watches" on public.watches;
drop policy if exists "admin or author deletes watches" on public.watches;
create policy "members read watches" on public.watches
  for select to authenticated using (public.can_see_household(household_id));
create policy "members add watches" on public.watches
  for insert to authenticated with check (public.is_editor() and household_id = public.my_household_id());
create policy "members edit watches" on public.watches
  for update to authenticated using (public.is_editor() and household_id = public.my_household_id())
  with check (public.is_editor() and household_id = public.my_household_id());
create policy "admin or author deletes watches" on public.watches
  for delete to authenticated using (
    public.is_editor() and household_id = public.my_household_id() and (public.is_admin() or created_by = public.my_person_id())
  );

drop policy if exists "members read ratings" on public.ratings;
drop policy if exists "editors change ratings" on public.ratings;
create policy "members read ratings" on public.ratings
  for select to authenticated using (exists (select 1 from public.watches w where w.id = watch_id));
create policy "editors change ratings" on public.ratings
  for all to authenticated
  using (public.is_editor() and exists (select 1 from public.watches w where w.id = watch_id and w.household_id = public.my_household_id()))
  with check (public.is_editor() and exists (select 1 from public.watches w where w.id = watch_id and w.household_id = public.my_household_id()));

-- Chats about a show follow who can see that show; the Family chat is the whole circle
drop policy if exists "members read comments" on public.comments;
drop policy if exists "comment as yourself" on public.comments;
create policy "members read comments" on public.comments
  for select to authenticated using (
    public.is_member() and (watch_id is null or exists (select 1 from public.watches w where w.id = watch_id))
  );
create policy "comment as yourself" on public.comments
  for insert to authenticated with check (
    public.is_member() and person_id = public.my_person_id()
    and (watch_id is null or exists (select 1 from public.watches w where w.id = watch_id))
  );

drop policy if exists "members read reactions" on public.reactions;
create policy "members read reactions" on public.reactions
  for select to authenticated using (exists (select 1 from public.watches w where w.id = watch_id));

-- Joining: each household has its own code; the viewer code (from 007) still makes viewers
create or replace function public.invite_valid(code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.household_invites where code = upper(btrim(invite_valid.code)))
      or exists (select 1 from public.household where viewer_code = upper(btrim(invite_valid.code)))
$$;

create or replace function public.open_profiles(code text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name from public.people p
  join public.household_invites i on i.household_id = p.household_id
  where p.user_id is null and i.code = upper(btrim(open_profiles.code))
  order by p.created_at
$$;

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
  home uuid;
  viewer boolean := false;
begin
  select household_id into home from public.household_invites where household_invites.code = join_household.code;
  if home is null then
    if exists (select 1 from public.household where viewer_code = join_household.code) then
      viewer := true;
    else
      raise exception 'invite_invalid';
    end if;
  end if;
  if claim is not null and not viewer then
    update public.people set user_id = new.id where id = claim and user_id is null and household_id = home;
    if not found then
      raise exception 'profile_taken';
    end if;
  elsif char_length(new_name) between 1 and 30 then
    insert into public.people (name, user_id, is_admin, is_viewer, household_id) values (new_name, new.id, false, viewer, home);
  else
    raise exception 'name_required';
  end if;
  return new;
end;
$$;

-- Lists ----------------------------------------------------------------------
-- A household's lists (Up Next is the built-in one). Privacy: only us, specific people, or the whole family.
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade default public.my_household_id(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  emoji text not null default '🍿' check (char_length(emoji) between 1 and 8),
  visibility text not null default 'household' check (visibility in ('household', 'people', 'circle')),
  shared_with uuid[] not null default '{}',
  -- "Help us pick": everyone who can see it votes
  ask_votes boolean not null default false,
  is_default boolean not null default false,
  created_by uuid references public.people (id) on delete set null default public.my_person_id(),
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  kind text not null default 'tv' check (kind in ('tv', 'movie')),
  ext_id integer not null,
  title text not null,
  poster text,
  year text,
  genres text[] not null default '{}',
  runtime integer,
  network text,
  added_by uuid references public.people (id) on delete set null default public.my_person_id(),
  votes uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (list_id, kind, ext_id)
);
create index if not exists list_items_list_idx on public.list_items (list_id);

create or replace function public.list_visible(l uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member() and exists (
    select 1 from public.lists x where x.id = l and (
      x.household_id = public.my_household_id()
      or x.visibility = 'circle'
      or (x.visibility = 'people' and public.my_person_id() = any (x.shared_with))
    )
  )
$$;
revoke all on function public.list_visible(uuid) from public;
grant execute on function public.list_visible(uuid) to authenticated;

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "see lists you're allowed to" on public.lists;
drop policy if exists "household adds lists" on public.lists;
drop policy if exists "household edits lists" on public.lists;
drop policy if exists "household removes lists" on public.lists;
create policy "see lists you're allowed to" on public.lists
  for select to authenticated using (public.list_visible(id));
create policy "household adds lists" on public.lists
  for insert to authenticated with check (public.is_editor() and household_id = public.my_household_id());
create policy "household edits lists" on public.lists
  for update to authenticated using (public.is_editor() and household_id = public.my_household_id())
  with check (public.is_editor() and household_id = public.my_household_id());
create policy "household removes lists" on public.lists
  for delete to authenticated using (public.is_editor() and household_id = public.my_household_id() and not is_default);

drop policy if exists "see items of visible lists" on public.list_items;
drop policy if exists "household adds items" on public.list_items;
drop policy if exists "household removes items" on public.list_items;
create policy "see items of visible lists" on public.list_items
  for select to authenticated using (public.list_visible(list_id));
create policy "household adds items" on public.list_items
  for insert to authenticated with check (
    public.is_editor() and exists (select 1 from public.lists l where l.id = list_id and l.household_id = public.my_household_id())
  );
create policy "household removes items" on public.list_items
  for delete to authenticated using (
    public.is_editor() and exists (select 1 from public.lists l where l.id = list_id and l.household_id = public.my_household_id())
  );

-- Votes go through this function: anyone who can see the list votes (once), nobody edits items directly
create or replace function public.toggle_vote(item uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_person_id();
  result uuid[];
begin
  if me is null or not exists (select 1 from public.list_items i where i.id = item and public.list_visible(i.list_id)) then
    raise exception 'not_allowed';
  end if;
  update public.list_items
    set votes = case when me = any (votes) then array_remove(votes, me) else array_append(votes, me) end
    where id = item
    returning votes into result;
  return result;
end;
$$;
revoke all on function public.toggle_vote(uuid) from public;
grant execute on function public.toggle_vote(uuid) to authenticated;

-- Up Next becomes each household's built-in list (the old table stays, unused, as a backup)
do $$
declare
  first_id uuid;
  up uuid;
begin
  select id into first_id from public.households order by created_at limit 1;
  if first_id is not null and not exists (select 1 from public.lists where household_id = first_id and is_default) then
    insert into public.lists (household_id, name, emoji, is_default, created_by)
      values (first_id, 'Up Next', '📌', true, (select id from public.people where is_admin limit 1))
      returning id into up;
    if to_regclass('public.up_next') is not null then
      insert into public.list_items (list_id, kind, ext_id, title, poster, year, genres, runtime, network, added_by, votes, created_at)
        select up, 'tv', show_id, show_name, poster, year, genres, runtime, network, added_by, wanted_by, created_at from public.up_next
        on conflict do nothing;
    end if;
  end if;
end $$;

-- Recommendations --------------------------------------------------------------
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  from_person uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  to_person uuid not null references public.people (id) on delete cascade,
  kind text not null default 'tv' check (kind in ('tv', 'movie')),
  ext_id integer not null,
  title text not null,
  poster text,
  year text,
  genres text[] not null default '{}',
  runtime integer,
  network text,
  note text not null default '' check (char_length(note) <= 280),
  status text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists recommendations_to_idx on public.recommendations (to_person, created_at desc);

alter table public.recommendations enable row level security;
drop policy if exists "see your recommendations" on public.recommendations;
drop policy if exists "recommend as yourself" on public.recommendations;
drop policy if exists "answer recommendations to you" on public.recommendations;
drop policy if exists "unsend your recommendations" on public.recommendations;
create policy "see your recommendations" on public.recommendations
  for select to authenticated using (from_person = public.my_person_id() or to_person = public.my_person_id());
create policy "recommend as yourself" on public.recommendations
  for insert to authenticated with check (public.is_member() and from_person = public.my_person_id() and to_person <> from_person);
create policy "answer recommendations to you" on public.recommendations
  for update to authenticated using (to_person = public.my_person_id()) with check (to_person = public.my_person_id());
create policy "unsend your recommendations" on public.recommendations
  for delete to authenticated using (from_person = public.my_person_id());

-- Notification preferences: everything, or only what's for you (@mentions, recommendations, votes)
alter table public.people add column if not exists notify_level text not null default 'all' check (notify_level in ('all', 'mine', 'off'));
create table if not exists public.chat_mutes (
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  thread text not null,
  primary key (person_id, thread)
);
alter table public.chat_mutes enable row level security;
drop policy if exists "own mutes" on public.chat_mutes;
create policy "own mutes" on public.chat_mutes
  for all to authenticated using (person_id = public.my_person_id()) with check (person_id = public.my_person_id());

-- Notifications for recommendations and "help us pick" (uses pititi_call from 007)
create or replace function public.pititi_on_recommendation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pititi_call(jsonb_build_object('type', 'recommendation', 'id', new.id));
  return new;
end;
$$;
drop trigger if exists pititi_notify_recommendation on public.recommendations;
create trigger pititi_notify_recommendation
  after insert on public.recommendations
  for each row execute function public.pititi_on_recommendation();

create or replace function public.pititi_on_vote_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ask_votes and not coalesce(old.ask_votes, false) then
    perform public.pititi_call(jsonb_build_object('type', 'votes', 'id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists pititi_notify_votes on public.lists;
create trigger pititi_notify_votes
  after insert or update of ask_votes on public.lists
  for each row execute function public.pititi_on_vote_request();

-- Live sync
do $$
declare
  t text;
begin
  foreach t in array array['households', 'lists', 'list_items', 'recommendations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select h.name as household, i.code as invite_code,
  (select count(*) from public.people p where p.household_id = h.id) as people,
  (select count(*) from public.watches w where w.household_id = h.id) as logs
from public.households h left join public.household_invites i on i.household_id = h.id
order by h.created_at;
