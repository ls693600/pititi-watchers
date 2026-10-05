-- Pititi Watchers 004: Up Next, the family watchlist with votes.
-- Everyone can add shows and heart them; delete is the admin or whoever added it.
-- Run once in Supabase > SQL Editor before deploying the matching app version.

create table if not exists public.up_next (
  id uuid primary key,
  show_id integer not null,
  show_name text not null,
  poster text,
  network text,
  genres text[] not null default '{}',
  year text,
  runtime integer,
  added_by uuid references public.people (id) on delete set null default public.my_person_id(),
  -- People who want to watch it (hearts)
  wanted_by uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (show_id)
);

alter table public.up_next enable row level security;

drop policy if exists "members read up next" on public.up_next;
drop policy if exists "members add up next" on public.up_next;
drop policy if exists "admin or adder removes up next" on public.up_next;
create policy "members read up next" on public.up_next
  for select to authenticated using (public.is_member());
create policy "members add up next" on public.up_next
  for insert to authenticated with check (public.is_member());
create policy "admin or adder removes up next" on public.up_next
  for delete to authenticated using (public.is_admin() or added_by = public.my_person_id());

-- Hearts go through this function so two phones voting at once never overwrite each other.
-- You heart for yourself, or for a family member without an account.
create or replace function public.toggle_want(item uuid, person uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  result uuid[];
begin
  if not public.is_member() then
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

revoke all on function public.toggle_want(uuid, uuid) from public;
grant execute on function public.toggle_want(uuid, uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'up_next'
  ) then
    alter publication supabase_realtime add table public.up_next;
  end if;
end $$;

select 'up_next ready' as status, count(*) as items from public.up_next;
