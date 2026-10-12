-- Pititi Watchers 010: fix sign-up (every new account failed with "Database error" after 008).
-- Cause: join_household() referred to its own variables as join_household.code, which PL/pgSQL
-- can't resolve (only parameters can be qualified that way). Variables are renamed so nothing is ambiguous.
-- Run once in Supabase > SQL Editor. The last part tries a sign-up and undoes it, to prove it works.

create or replace function public.join_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_claim uuid := nullif(new.raw_user_meta_data ->> 'person_id', '')::uuid;
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  v_home uuid;
  v_viewer boolean := false;
begin
  select i.household_id into v_home from public.household_invites i where i.code = v_code;
  if v_home is null then
    if exists (select 1 from public.household h where h.viewer_code = v_code) then
      v_viewer := true;
    else
      raise exception 'invite_invalid';
    end if;
  end if;

  if v_claim is not null and not v_viewer then
    -- Picking your own name from the list: it must be in the household this code belongs to
    update public.people p set user_id = new.id
      where p.id = v_claim and p.user_id is null and p.household_id = v_home;
    if not found then
      raise exception 'profile_taken';
    end if;
  elsif char_length(v_name) between 1 and 30 then
    insert into public.people (name, user_id, is_admin, is_viewer, household_id)
      values (v_name, new.id, false, v_viewer, v_home);
  else
    raise exception 'name_required';
  end if;
  return new;
end;
$$;

-- Self-test: a pretend sign-up with a real household code, rolled back right away (nothing is kept)
do $$
declare
  test_code text;
begin
  select code into test_code from public.household_invites limit 1;
  begin
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
      values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'pititi-selftest@example.invalid', jsonb_build_object('invite_code', test_code, 'name', 'Self test'), now(), now());
    raise exception 'selftest_rollback';
  exception
    when others then
      if sqlerrm <> 'selftest_rollback' then
        raise exception 'Sign-up self-test FAILED: %', sqlerrm;
      end if;
  end;
end $$;

select 'sign-up fixed and tested' as status,
  (select count(*) from public.people where name = 'Self test') as leftovers_should_be_0;
