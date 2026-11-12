-- Pititi Watchers 015: fix "Notifications: all / only mine / off" for everyone but the admin.
-- Bug: the app saved it with a plain update on people, which only the admin is allowed to do (row-level security).
-- For everyone else the update matched no row, so the choice looked saved but never reached the server.
-- Fix: a function that changes only YOUR OWN setting (same pattern as set_evening in 011).
-- Safe to run more than once. Run in Supabase > SQL Editor BEFORE deploying the app version that uses it.

create or replace function public.set_notify_level(level text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if level not in ('all', 'mine', 'off') then
    raise exception 'notify_level_invalid';
  end if;
  update public.people set notify_level = level where user_id = auth.uid();
  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;
revoke all on function public.set_notify_level(text) from public;
grant execute on function public.set_notify_level(text) to authenticated;

select 'notification setting fix ready' as status;
