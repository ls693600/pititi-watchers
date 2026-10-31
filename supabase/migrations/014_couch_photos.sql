-- Pititi Watchers 014: a photo of the night on a log ("couch night photo").
-- The whole family sees them; only your own household's logs get your photos; you (or the admin) remove yours.
-- Files live in a PRIVATE storage bucket: the app shows them through short-lived signed links, never public URLs.
-- Safe to run before deploying and more than once: the app hides photos until this has run.
-- Run once in Supabase > SQL Editor.

-- Storage: private bucket, phone photos already shrunk to ~200 KB by the app (2 MB hard limit, JPEG only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('couch-photos', 'couch-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "family reads couch photo files" on storage.objects;
drop policy if exists "households upload couch photo files" on storage.objects;
drop policy if exists "remove own couch photo files" on storage.objects;
create policy "family reads couch photo files" on storage.objects
  for select to authenticated using (bucket_id = 'couch-photos' and public.is_member());
-- Files go in a folder named after your household: viewers (no household) can't upload
create policy "households upload couch photo files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'couch-photos'
    and public.is_member()
    and (storage.foldername(name))[1] = public.my_household_id()::text
  );
create policy "remove own couch photo files" on storage.objects
  for delete to authenticated using (bucket_id = 'couch-photos' and (owner = auth.uid() or public.is_admin()));

-- One row per photo
create table if not exists public.couch_photos (
  id uuid primary key,
  watch_id uuid not null references public.watches (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade default public.my_person_id(),
  -- Path inside the couch-photos bucket: <household id>/<photo id>.jpg
  path text not null unique,
  -- The night it was taken (the phone's local date)
  night date not null,
  created_at timestamptz not null default now()
);
create index if not exists couch_photos_watch_idx on public.couch_photos (watch_id);

alter table public.couch_photos enable row level security;

drop policy if exists "family reads couch photos" on public.couch_photos;
drop policy if exists "add photos to your own logs" on public.couch_photos;
drop policy if exists "remove own couch photos" on public.couch_photos;
create policy "family reads couch photos" on public.couch_photos
  for select to authenticated using (public.is_member());
create policy "add photos to your own logs" on public.couch_photos
  for insert to authenticated with check (
    public.is_member()
    and person_id = public.my_person_id()
    and exists (select 1 from public.watches w where w.id = watch_id and w.household_id = public.my_household_id())
  );
create policy "remove own couch photos" on public.couch_photos
  for delete to authenticated using (person_id = public.my_person_id() or public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couch_photos'
  ) then
    alter publication supabase_realtime add table public.couch_photos;
  end if;
end $$;

select 'couch photos ready' as status,
  (select count(*) from public.couch_photos) as photos,
  (select public from storage.buckets where id = 'couch-photos') as bucket_is_public;
