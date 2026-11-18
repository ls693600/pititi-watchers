-- Pititi Watchers: database rules, tested on a fresh copy built from migrations 001-021 (CI: supabase test db).
-- Two households, a viewer and a stranger; each check runs as that person, exactly as the app's requests do.
begin;
create extension if not exists pgtap with schema extensions;
select plan(72);

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

-- Predictions (017): guesses stay sealed until the household logs the episode --------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ann@test.local', '{"invite_code":"TESTAAAA","name":"Ann"}');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ insert into public.predictions (id, show_id, season, episode, question) values ('e0000000-0000-0000-0000-000000000001', 1, 1, 5, 'Who did it?') $$,
  'a member makes a prediction');
select lives_ok(
  $$ insert into public.prediction_guesses (prediction_id, guess) values ('e0000000-0000-0000-0000-000000000001', 'The butler') $$,
  '... and seals her guess');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
insert into public.prediction_guesses (prediction_id, guess) values ('e0000000-0000-0000-0000-000000000001', 'The gardener');
select is((select count(*) from public.prediction_guesses), 1::bigint, 'before the episode, you only see your own guess (others are sealed)');
select throws_ok($$ select public.judge_guess('e0000000-0000-0000-0000-000000000001', public.my_person_id(), 'right') $$, 'P0001', 'still_sealed', 'nobody can judge before the reveal');
reset role;
update public.watches set episodes_watched = 5 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select is((select count(*) from public.prediction_guesses), 2::bigint, 'once the household logs the episode, every guess opens');
select is_empty($$ update public.prediction_guesses set guess = 'Changed my mind' where person_id = public.my_person_id() returning 1 $$, 'no changing your guess after the reveal');
select lives_ok($$ select public.judge_guess('e0000000-0000-0000-0000-000000000001', (select person_id from public.prediction_guesses where guess = 'The butler'), 'right') $$, 'anyone in the household marks a guess right or wrong');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*) from public.predictions) + (select count(*) from public.prediction_guesses), 0::bigint, 'other households never see your predictions');
select throws_ok($$ select public.judge_guess('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'wrong') $$, 'P0001', 'not_your_household', 'other households cannot judge');
reset role;

-- Movie night (018): you only see someone's vote on a title after you voted on it ---------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ insert into public.movie_nights (id, titles) values ('f0000000-0000-0000-0000-000000000001', '[{"kind":"movie","extId":1},{"kind":"movie","extId":2}]') $$,
  'a member starts a movie night');
insert into public.movie_night_votes (night_id, ref, yes) values ('f0000000-0000-0000-0000-000000000001', 'movie:1', true);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select is((select count(*) from public.movie_night_votes), 0::bigint, 'before voting on a title, you cannot see how others voted on it');
insert into public.movie_night_votes (night_id, ref, yes) values ('f0000000-0000-0000-0000-000000000001', 'movie:1', true);
select is((select count(*) from public.movie_night_votes where ref = 'movie:1'), 2::bigint, '... after you vote, you see everyone''s vote on it (a match)');
select throws_ok(
  $$ insert into public.movie_night_votes (night_id, person_id, ref, yes) values ('f0000000-0000-0000-0000-000000000001', (select id from public.people where name = 'Alice'), 'movie:2', false) $$,
  '42501', null, 'nobody votes in someone else''s name');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*) from public.movie_nights) + (select count(*) from public.movie_night_votes), 0::bigint, 'other households never see your movie nights');
select throws_ok(
  $$ insert into public.movie_night_votes (night_id, ref, yes) values ('f0000000-0000-0000-0000-000000000001', 'movie:2', true) $$,
  '42501', null, 'other households cannot vote in yours');
reset role;

-- Watch parties (019): only the host and invited households see a party; joined people control it ------------
insert into public.households (id, name, share_log) values ('c0000000-0000-0000-0000-00000000000c', 'Home C', true);
insert into public.household_invites (household_id, code) values ('c0000000-0000-0000-0000-00000000000c', 'TESTCCCC');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carl@test.local', '{"invite_code":"TESTCCCC","name":"Carl"}');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ select public.create_watch_party('a1000000-0000-0000-0000-000000000001', array['b0000000-0000-0000-0000-00000000000b'::uuid], 'tv', 1, 'Show A', null, 1, 2, 50, now() + interval '1 hour') $$,
  'a member plans a watch party with another household');
select throws_ok(
  $$ insert into public.watch_parties (id, host_household_id, kind, ext_id, title, season, episode, starts_at) values ('a1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b', 'tv', 1, 'Fake', 1, 1, now()) $$,
  '42501', null, 'parties are only created through the app''s function (never in another household''s name)');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*) from public.watch_parties), 1::bigint, 'the invited household sees the party');
select throws_ok($$ select public.party_control('a1000000-0000-0000-0000-000000000001', 'pause') $$, 'P0001', 'not_playing', 'nobody pauses a party that has not started');
select throws_ok(
  $$ insert into public.watch_party_people (party_id, person_id, answer) values ('a1000000-0000-0000-0000-000000000001', (select id from public.people where name = 'Alice'), 'no') $$,
  '42501', null, 'nobody answers in someone else''s name');
select lives_ok($$ insert into public.watch_party_people (party_id, answer) values ('a1000000-0000-0000-0000-000000000001', 'join') $$, 'an invited person says Join');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is((select public.party_control('a1000000-0000-0000-0000-000000000001', 'start') ->> 'state'), 'playing', 'the host starts the party (shared 3-2-1)');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select public.party_control('a1000000-0000-0000-0000-000000000001', 'pause', 1112) ->> 'position_sec'), '1112', 'a guest who joined pauses for everyone');
select throws_ok($$ select public.party_control('a1000000-0000-0000-0000-000000000001', 'end') $$, 'P0001', 'host_only', 'only the host household ends the party');
select lives_ok(
  $$ insert into public.watch_party_messages (id, party_id, kind, body, at_sec) values ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'text', 'NO WAY', 1112) $$,
  'a guest chats in the party');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select is((select count(*) from public.watch_parties) + (select count(*) from public.watch_party_messages) + (select count(*) from public.watch_party_people), 0::bigint, 'a household that was not invited sees nothing of the party');
select throws_ok($$ select public.party_control('a1000000-0000-0000-0000-000000000001', 'resume') $$, 'P0001', 'not_your_party', '... and cannot control it');
select throws_ok(
  $$ insert into public.watch_party_messages (id, party_id, body) values ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'hi') $$,
  '42501', null, '... or post in its chat');
select throws_ok($$ select public.pititi_party_tick() $$, '42501', null, 'members cannot run the party job');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is((select public.party_control('a1000000-0000-0000-0000-000000000001', 'end') ->> 'state'), 'ended', 'the host ends the party');
select throws_ok(
  $$ insert into public.watch_party_messages (id, party_id, body) values ('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'late') $$,
  '42501', null, 'the chat closes when the party ends (but stays readable)');
reset role;

-- Watchers stay in the log's household (020) -----------------------------------------------------------------
update public.watches set watched_by = array[(select id from public.people where name = 'Alice'), (select id from public.people where name = 'Bob')]
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select watched_by from public.watches where id = 'aaaaaaaa-0000-0000-0000-000000000001'), array[(select id from public.people where name = 'Alice')], 'a log never keeps someone from another household as a watcher');
update public.watches set watched_by = array[(select id from public.people where name = 'Alice'), (select id from public.people where name = 'Ann')]
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.ratings (watch_id, person_id, stars) values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.people where name = 'Ann'), 4);
update public.people set household_id = 'b0000000-0000-0000-0000-00000000000b' where name = 'Ann';
select is((select watched_by from public.watches where id = 'aaaaaaaa-0000-0000-0000-000000000001'), array[(select id from public.people where name = 'Alice')], 'moving a person to another household takes them off the old household''s logs');
select is((select count(*) from public.ratings where watch_id = 'aaaaaaaa-0000-0000-0000-000000000001' and person_id = (select id from public.people where name = 'Ann')), 0::bigint, '... and their rating there no longer blocks the average');
update public.people set household_id = 'a0000000-0000-0000-0000-00000000000a' where name = 'Ann';

-- Safe saves (021): removing keeps the log 30 days; merge moves the chat; ratings stay in the household --------
insert into public.watches (id, show_id, show_name, season, month, status, household_id, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000005', 1, 'Show A', 1, '2026-09', 'watching', 'a0000000-0000-0000-0000-00000000000a', (select id from public.people where name = 'Alice'));
insert into public.comments (id, watch_id, person_id, body) values
  ('d0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005', (select id from public.people where name = 'Ann'), 'On the copy');
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select throws_ok($$ select public.remove_log('aaaaaaaa-0000-0000-0000-000000000001') $$, 'P0001', 'not_allowed', 'only the admin or the person who added a log removes it');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.merge_logs('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005') $$, 'merging two logs of the same show');
select is((select watch_id from public.comments where id = 'd0000000-0000-0000-0000-000000000005'), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, '... moves everyone''s chat to the log you keep');
select is((select count(*) from public.watches where id = 'aaaaaaaa-0000-0000-0000-000000000005'), 0::bigint, '... and the copy is gone for everyone');
select throws_ok($$ select public.merge_logs('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001') $$, 'P0001', 'not_allowed', 'nobody merges another household''s log into theirs');
select lives_ok($$ select public.remove_log('aaaaaaaa-0000-0000-0000-000000000001') $$, 'the author removes a log');
select is((select count(*) from public.watches where id = 'aaaaaaaa-0000-0000-0000-000000000001') + (select count(*) from public.comments where watch_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, '... it and its chat disappear');
select lives_ok($$ select public.restore_log('aaaaaaaa-0000-0000-0000-000000000001') $$, 'Undo brings it back');
select is((select count(*) from public.comments where watch_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint, '... with everyone''s chat, not only yours');
select throws_ok(
  $$ insert into public.ratings (watch_id, person_id, stars) values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.people where name = 'Bob'), 3) $$,
  '42501', null, 'nobody rates in the name of someone from another household');
update public.watches set updated_at = '2000-01-01' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select ok((select updated_at > now() - interval '1 minute' from public.watches where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'a log''s last-changed time comes from the server, not the phone');
reset role;

-- App health (016): only the admin reads it; nobody can trigger the watchdog from the app
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is((select count(*) from public.job_runs), 0::bigint, 'app health is hidden from non-admins');
select throws_ok($$ select public.pititi_health_check() $$, '42501', null, 'members cannot run the health watchdog');
reset role;
update public.job_runs set last_ok = now() - interval '3 days', last_alert = null where job = 'reminders';
select is(public.pititi_health_check(), array['reminders'], 'a late daily reminder is reported');
select is(public.pititi_health_check(), '{}'::text[], '... only once in 12 hours');

select * from finish();
rollback;
