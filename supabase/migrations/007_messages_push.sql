-- Pititi Watchers 007: Family chat (messages not tied to a show), phone notifications, and viewers
-- (people who can see everything and chat, but can't add, rate or change shows).
-- Run once in Supabase > SQL Editor. Then run supabase/private/007_secret.sql (kept off GitHub).

-- A message with no show is in the Family chat
alter table public.comments alter column watch_id drop not null;

-- One row per phone that turned notifications on
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "see own phones" on public.push_subscriptions;
drop policy if exists "add own phone" on public.push_subscriptions;
drop policy if exists "update own phone" on public.push_subscriptions;
drop policy if exists "remove own phone" on public.push_subscriptions;
create policy "see own phones" on public.push_subscriptions
  for select to authenticated using (person_id = public.my_person_id());
create policy "add own phone" on public.push_subscriptions
  for insert to authenticated with check (public.is_member() and person_id = public.my_person_id());
create policy "update own phone" on public.push_subscriptions
  for update to authenticated using (person_id = public.my_person_id()) with check (person_id = public.my_person_id());
create policy "remove own phone" on public.push_subscriptions
  for delete to authenticated using (person_id = public.my_person_id());

-- The server function is called with a shared secret kept in Vault (set by 007_secret.sql)
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.pititi_call(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'pititi_hook_secret';
  -- Not set up yet: messages still save, just no notification
  if secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://pnazcanolltupqydemri.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pititi-secret', secret),
    body := payload
  );
end;
$$;

revoke all on function public.pititi_call(jsonb) from public, anon, authenticated;

create or replace function public.pititi_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pititi_call(jsonb_build_object('type', 'comment', 'id', new.id));
  return new;
end;
$$;

drop trigger if exists pititi_notify_comment on public.comments;
create trigger pititi_notify_comment
  after insert on public.comments
  for each row execute function public.pititi_on_comment();

-- New-episode reminders once a day at 21:00 UTC (5 PM Eastern in summer, 4 PM in winter)
do $$
begin
  perform cron.unschedule('pititi-reminders') where exists (select 1 from cron.job where jobname = 'pititi-reminders');
  perform cron.schedule('pititi-reminders', '0 21 * * *', $job$ select public.pititi_call('{"type":"reminders"}'::jsonb) $job$);
end $$;

-- Viewers --------------------------------------------------------------------
-- A viewer joins with the viewer invite code: they read everything and can chat/react,
-- but every change to shows, ratings and Up Next is refused by the database.
alter table public.people add column if not exists is_viewer boolean not null default false;
alter table public.household add column if not exists viewer_code text;
update public.household set viewer_code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)) where viewer_code is null;

-- Members who can change the log (everyone except viewers)
create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.people where user_id = auth.uid() and not is_viewer) $$;
revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to authenticated;

drop policy if exists "members add watches" on public.watches;
drop policy if exists "members edit watches" on public.watches;
drop policy if exists "admin or author deletes watches" on public.watches;
create policy "members add watches" on public.watches
  for insert to authenticated with check (public.is_editor());
create policy "members edit watches" on public.watches
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "admin or author deletes watches" on public.watches
  for delete to authenticated using (public.is_editor() and (public.is_admin() or created_by = public.my_person_id()));

drop policy if exists "members use ratings" on public.ratings;
drop policy if exists "members read ratings" on public.ratings;
drop policy if exists "editors change ratings" on public.ratings;
create policy "members read ratings" on public.ratings
  for select to authenticated using (public.is_member());
create policy "editors change ratings" on public.ratings
  for all to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists "members add up next" on public.up_next;
drop policy if exists "admin or adder removes up next" on public.up_next;
create policy "members add up next" on public.up_next
  for insert to authenticated with check (public.is_editor());
create policy "admin or adder removes up next" on public.up_next
  for delete to authenticated using (public.is_editor() and (public.is_admin() or added_by = public.my_person_id()));

-- Hearts on Up Next: editors only
create or replace function public.toggle_want(item uuid, person uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  result uuid[];
begin
  if not public.is_editor() then
    raise exception 'not_member';
  end if;
  if person <> public.my_person_id()
     and exists (select 1 from public.people where id = person and user_id is not null) then
    raise exception 'not_yours';
  end if;
  update public.up_next
    set wanted_by = case
      when person = any (wanted_by) then array_remove(wanted_by, person)
      else array_append(wanted_by, person)
    end
    where id = item
    returning wanted_by into result;
  return result;
end;
$$;

-- Either code works to sign up; only the family code can claim an existing profile
create or replace function public.invite_valid(code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.household where upper(btrim(code)) in (invite_code, viewer_code)) $$;

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
  viewer boolean;
begin
  if exists (select 1 from public.household where invite_code = code) then
    viewer := false;
  elsif exists (select 1 from public.household where viewer_code = code) then
    viewer := true;
  else
    raise exception 'invite_invalid';
  end if;
  if claim is not null and not viewer then
    update public.people set user_id = new.id where id = claim and user_id is null;
    if not found then
      raise exception 'profile_taken';
    end if;
  elsif char_length(new_name) between 1 and 30 then
    insert into public.people (name, user_id, is_admin, is_viewer) values (new_name, new.id, false, viewer);
  else
    raise exception 'name_required';
  end if;
  return new;
end;
$$;

-- Viewers can't promote themselves: only the admin changes is_viewer / is_admin (policy "admin renames people")
create or replace function public.people_keep_role()
returns trigger
language plpgsql
as $$
begin
  if (new.is_viewer is distinct from old.is_viewer or new.is_admin is distinct from old.is_admin)
     and current_user = 'authenticated' and not public.is_admin() then
    raise exception 'role_locked';
  end if;
  return new;
end;
$$;
drop trigger if exists people_keep_role on public.people;
create trigger people_keep_role before update on public.people
  for each row execute function public.people_keep_role();

select 'messages and notifications ready' as status,
  (select count(*) from public.push_subscriptions) as phones,
  (select viewer_code from public.household where id = 1) as viewer_code;
