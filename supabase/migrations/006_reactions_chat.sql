-- Pititi Watchers 006: reactions on each other's stars and a short family chat per show.
-- Safe to run before or after deploying: the app works without these tables (features stay hidden).
-- Run once in Supabase > SQL Editor.

create table if not exists public.reactions (
  watch_id uuid not null references public.watches (id) on delete cascade,
  -- Who reacted (always yourself)
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  -- Whose rating it's on
  target_id uuid not null references public.people (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (watch_id, person_id, target_id)
);

create table if not exists public.comments (
  id uuid primary key,
  watch_id uuid not null references public.watches (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists comments_watch_idx on public.comments (watch_id, created_at);

alter table public.reactions enable row level security;
alter table public.comments enable row level security;

-- Everyone in the family reads; you only write as yourself; you remove your own (admin removes any comment)
drop policy if exists "members read reactions" on public.reactions;
drop policy if exists "react as yourself" on public.reactions;
drop policy if exists "change own reaction" on public.reactions;
drop policy if exists "remove own reaction" on public.reactions;
create policy "members read reactions" on public.reactions
  for select to authenticated using (public.is_member());
create policy "react as yourself" on public.reactions
  for insert to authenticated with check (public.is_member() and person_id = public.my_person_id() and target_id <> person_id);
create policy "change own reaction" on public.reactions
  for update to authenticated using (person_id = public.my_person_id()) with check (person_id = public.my_person_id() and target_id <> person_id);
create policy "remove own reaction" on public.reactions
  for delete to authenticated using (person_id = public.my_person_id());

drop policy if exists "members read comments" on public.comments;
drop policy if exists "comment as yourself" on public.comments;
drop policy if exists "remove own comment" on public.comments;
create policy "members read comments" on public.comments
  for select to authenticated using (public.is_member());
create policy "comment as yourself" on public.comments
  for insert to authenticated with check (public.is_member() and person_id = public.my_person_id());
create policy "remove own comment" on public.comments
  for delete to authenticated using (person_id = public.my_person_id() or public.is_admin());

do $$
declare
  t text;
begin
  foreach t in array array['reactions', 'comments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select 'reactions and chat ready' as status,
  (select count(*) from public.reactions) as reactions,
  (select count(*) from public.comments) as comments;
