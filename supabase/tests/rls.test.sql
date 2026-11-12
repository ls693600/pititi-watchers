-- Pititi Watchers: database rules, tested on a fresh copy built from migrations 001-014 (CI: supabase test db).
-- Two households, a viewer and a stranger; each check runs as that person, exactly as the app's requests do.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Fixture (as the database owner, rules off) ----------------------------------------------------------------
insert into public.households (id, name, share_log) values
  ('a0000000-0000-0000-0000-00000000000a', 'Home A', true),
  ('b0000000-0000-0000-0000-00000000000b', 'Home B', true);
insert into public.household_invites (household_id, code) values
  ('a0000000-0000-0000-0000-00000000000a', 'TESTAAAA'),
  ('b0000000-0000-0000-0000-00000000000b', 'TESTBBBB');
update public.household set viewer_code = 'TESTVIEW' where id = 1;

-- Real sign-ups: the join_household trigger reads the invite code and name, like the app's sign-up form
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', '{"invite_code":"testaaaa","name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local', '{"invite_code":"TESTBBBB","name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vera@test.local', '{"invite_code":"TESTVIEW","name":"Vera"}');

select is((select household_id from public.people where user_id = '11111111-1111-1111-1111-111111111111'), 'a0000000-0000-0000-0000-00000000000a'::uuid, 'sign-up with a household code joins that household');
select ok((select is_viewer and household_id is null from public.people where user_id = '33333333-3333-3333-3333-333333333333'), 'sign-up with the viewer code makes a viewer outside any household');
select throws_ok(
  $$ insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@test.local', '{"invite_code":"WRONG123","name":"Eve"}') $$,
  'P0001', 'invite_invalid', 'sign-up with a wrong code is refused');

insert into public.watches (id, show_id, show_name, season, month, status, household_id, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'Show A', 1, '2026-10', 'watching', 'a0000000-0000-0000-0000-00000000000a', (select id from public.people where name = 'Alice')),
  ('bbbbbbbb-0000-0000-0000-000000000001', 2, 'Show B', 1, '2026-10', 'watching', 'b0000000-0000-0000-0000-00000000000b', (select id from public.people where name = 'Bob'));

-- Alice (Home A) ---------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*) from public.watches), 2::bigint, 'a member sees her log and households that share theirs');
select lives_ok(
  $$ insert into public.watches (id, show_id, show_name, season, month, status, household_id, created_by) values ('aaaaaaaa-0000-0000-0000-000000000002', 3, 'Show A2', 1, '2026-10', 'done', 'a0000000-0000-0000-0000-00000000000a', public.my_person_id()) $$,
  'a member adds to her own household log');
select throws_ok(
  $$ insert into public.watches (id, show_id, show_name, season, month, status, household_id) values ('aaaaaaaa-0000-0000-0000-000000000003', 4, 'Sneaky', 1, '2026-10', 'done', 'b0000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'a member cannot add to another household''s log');
select is_empty($$ update public.watches set show_name = 'Hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1 $$, 'a member cannot edit another household''s log');
select is_empty($$ delete from public.watches where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1 $$, 'a member cannot delete another household''s log');
select is_empty(
  $$ update public.people set is_admin = true where user_id = '11111111-1111-1111-1111-111111111111' returning 1 $$,
  'a member cannot make herself admin (only the admin edits people)');
select lives_ok($$ select public.set_notify_level('off') $$, 'a member changes her own notification setting');
select is((select notify_level from public.people where user_id = '11111111-1111-1111-1111-111111111111'), 'off', '... and it is saved');
select is_empty(
  $$ update public.people set notify_level = 'off' where user_id = '22222222-2222-2222-2222-222222222222' returning 1 $$,
  'a member cannot change someone else''s notification setting');
select lives_ok(
  $$ insert into public.couch_photos (id, watch_id, path, night) values ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a/c1.jpg', '2026-10-20') $$,
  'a member adds a photo to her household''s log');
select throws_ok(
  $$ insert into public.couch_photos (id, watch_id, path, night) values ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a/c2.jpg', '2026-10-20') $$,
  '42501', null, 'a member cannot add a photo to another household''s log');
select throws_ok(
  $$ insert into public.episode_reactions (kind, show_id, season, episode, person_id, emoji) values ('tv', 2, 1, 1, (select id from public.people where name = 'Bob'), '🤯') $$,
  '42501', null, 'a member cannot react in someone else''s name');
select lives_ok(
  $$ insert into public.episode_reactions (kind, show_id, season, episode, emoji) values ('tv', 2, 1, 1, '🤯') $$,
  'a member reacts to an episode as herself');
reset role;

-- Bob (Home B) when Home A stops sharing its log -------------------------------------------------------------
update public.households set share_log = false where id = 'a0000000-0000-0000-0000-00000000000a';
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*) from public.watches where household_id = 'a0000000-0000-0000-0000-00000000000a'), 0::bigint, 'a private household log is hidden from other households');
select is((select count(*) from public.couch_photos), 1::bigint, 'the whole family sees couch photos');
select is_empty($$ delete from public.couch_photos where id = 'c0000000-0000-0000-0000-000000000001' returning 1 $$, 'a member cannot remove someone else''s photo');
reset role;

-- Vera (viewer) ----------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ insert into public.watches (id, show_id, show_name, season, month, status, household_id) values ('aaaaaaaa-0000-0000-0000-000000000009', 9, 'Viewer show', 1, '2026-10', 'done', 'a0000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'a viewer cannot add shows');
select lives_ok(
  $$ insert into public.comments (id, watch_id, body) values ('d0000000-0000-0000-0000-000000000001', null, 'Hi family') $$,
  'a viewer can chat');
reset role;

-- A stranger (signed in, not in the family) ------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
select is((select count(*) from public.watches) + (select count(*) from public.people) + (select count(*) from public.comments) + (select count(*) from public.couch_photos), 0::bigint, 'a stranger sees nothing at all');
select throws_ok(
  $$ insert into public.comments (id, watch_id, body) values ('d0000000-0000-0000-0000-000000000002', null, 'spam') $$,
  '42501', null, 'a stranger cannot post');
reset role;

select * from finish();
rollback;
