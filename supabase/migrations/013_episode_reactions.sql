-- Pititi Watchers 013: "how was this episode?" One emoji per person per episode.
-- Keyed by the show (not a household's log) so the whole family's reactions to the same episode line up.
-- Safe to run before deploying and more than once: the app hides episode reactions until this table exists.
-- Run once in Supabase > SQL Editor.

create table if not exists public.episode_reactions (
  kind text not null default 'tv' check (kind in ('tv', 'movie')),
  show_id integer not null,
  season integer not null check (season >= 0),
  episode integer not null check (episode >= 1),
  -- Who reacted (always yourself)
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  emoji text not null check (emoji in ('🤯', '😭', '😂', '😍', '🥱')),
  created_at timestamptz not null default now(),
  primary key (kind, show_id, season, episode, person_id)
);

alter table public.episode_reactions enable row level security;

-- The whole family reads; you only react, change and remove as yourself
drop policy if exists "members read episode reactions" on public.episode_reactions;
drop policy if exists "react to episodes as yourself" on public.episode_reactions;
drop policy if exists "change own episode reaction" on public.episode_reactions;
drop policy if exists "remove own episode reaction" on public.episode_reactions;
create policy "members read episode reactions" on public.episode_reactions
  for select to authenticated using (public.is_member());
create policy "react to episodes as yourself" on public.episode_reactions
  for insert to authenticated with check (public.is_member() and person_id = public.my_person_id());
create policy "change own episode reaction" on public.episode_reactions
  for update to authenticated using (person_id = public.my_person_id()) with check (person_id = public.my_person_id());
create policy "remove own episode reaction" on public.episode_reactions
  for delete to authenticated using (person_id = public.my_person_id());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'episode_reactions'
  ) then
    alter publication supabase_realtime add table public.episode_reactions;
  end if;
end $$;

select 'episode reactions ready' as status, (select count(*) from public.episode_reactions) as reactions;
