-- Pititi Watchers 007: Family chat (messages not tied to a show) and phone notifications.
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

select 'messages and notifications ready' as status,
  (select count(*) from public.push_subscriptions) as phones;
