-- Pititi Watchers 022: a phone's notifications follow whoever is signed in on it.
-- Before: if someone else had used the phone and never turned notifications off, turning them on failed (the phone
-- still belonged to the first person, who kept getting the notifications). Now turning them on takes the phone over.
-- Run in Supabase > SQL Editor. Safe to run more than once.

create or replace function public.claim_push(phone text, key_p256dh text, key_auth text, agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_person_id() is null then
    raise exception 'not_member';
  end if;
  if phone is null or phone !~ '^https://' or char_length(phone) > 1000 then
    raise exception 'bad_endpoint';
  end if;
  insert into public.push_subscriptions (endpoint, person_id, p256dh, auth, user_agent)
    values (phone, public.my_person_id(), key_p256dh, key_auth, left(agent, 200))
  on conflict (endpoint) do update
    set person_id = excluded.person_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;
revoke all on function public.claim_push(text, text, text, text) from public, anon;
grant execute on function public.claim_push(text, text, text, text) to authenticated;

select 'phone notifications fixed' as status, (select count(*) from public.push_subscriptions) as phones;
