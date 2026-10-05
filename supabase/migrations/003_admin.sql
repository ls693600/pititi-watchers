-- Pititi Watchers 003: Leandro is the only admin.
-- Admin: invite code, add/rename people, delete any log.
-- Everyone else: log and rate; delete only logs they added.
-- Run once in Supabase > SQL Editor, before deploying the matching app version.

alter table public.people add column if not exists is_admin boolean not null default false;

-- At most one admin, ever
create unique index if not exists people_single_admin on public.people (is_admin) where is_admin;

update public.people set is_admin = true
where name = 'Leandro' and user_id is not null
  and not exists (select 1 from public.people where is_admin);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.people where user_id = auth.uid() and is_admin) $$;

create or replace function public.my_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from public.people where user_id = auth.uid() $$;

-- Who added each log (older logs have none, so only the admin can delete them)
alter table public.watches add column if not exists created_by uuid references public.people (id) on delete set null;
alter table public.watches alter column created_by set default public.my_person_id();

-- Watches: everyone reads, adds and edits; delete is admin or the person who added it
drop policy if exists "members use watches" on public.watches;
drop policy if exists "members read watches" on public.watches;
drop policy if exists "members add watches" on public.watches;
drop policy if exists "members edit watches" on public.watches;
drop policy if exists "admin or author deletes watches" on public.watches;
create policy "members read watches" on public.watches
  for select to authenticated using (public.is_member());
create policy "members add watches" on public.watches
  for insert to authenticated with check (public.is_member());
create policy "members edit watches" on public.watches
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "admin or author deletes watches" on public.watches
  for delete to authenticated using (public.is_admin() or created_by = public.my_person_id());

-- Keep the original author when someone else edits a log
create or replace function public.watches_keep_author()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
drop trigger if exists watches_keep_author on public.watches;
create trigger watches_keep_author before update on public.watches
  for each row execute function public.watches_keep_author();

-- People: everyone sees the family; only the admin adds or renames
drop policy if exists "members add people" on public.people;
drop policy if exists "members rename people" on public.people;
drop policy if exists "admin adds people" on public.people;
drop policy if exists "admin renames people" on public.people;
create policy "admin adds people" on public.people
  for insert to authenticated with check (public.is_admin() and user_id is null and not is_admin);
create policy "admin renames people" on public.people
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Logins and the admin flag can't be changed from the app, by anyone
create or replace function public.people_keep_login()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated'
     and (new.user_id is distinct from old.user_id or new.is_admin is distinct from old.is_admin) then
    raise exception 'locked_field';
  end if;
  return new;
end;
$$;

-- Invite code: admin only
drop policy if exists "members read household" on public.household;
drop policy if exists "members renew invite" on public.household;
drop policy if exists "admin reads household" on public.household;
drop policy if exists "admin renews invite" on public.household;
create policy "admin reads household" on public.household
  for select to authenticated using (public.is_admin());
create policy "admin renews invite" on public.household
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- New sign-ups are never admins
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
    insert into public.people (name, user_id, is_admin) values (new_name, new.id, false);
  else
    raise exception 'name_required';
  end if;
  return new;
end;
$$;

-- Sanity check: shows who the admin is after running
select name, is_admin, user_id is not null as has_account from public.people order by created_at;
