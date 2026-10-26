-- Ratings out of 10 (IMDb style), one per show.
-- Adds ratings.score (1–10) next to the old stars (1–5) and doubles every existing rating into it.
-- Phones still on the old app keep writing stars; a trigger turns those into score, so nothing gets lost.
-- Safe to run more than once in Supabase > SQL Editor.

alter table public.ratings add column if not exists score smallint check (score between 1 and 10);

-- Existing ratings: 4★ → 8, 5★ → 10 (only rows not converted yet)
update public.ratings set score = stars * 2 where score is null;

alter table public.ratings alter column score set not null;

-- Old app versions only send stars: keep score in step with them
create or replace function public.ratings_score_from_stars() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.score is null then new.score := new.stars * 2; end if;
  elsif new.score is not distinct from old.score and new.stars is distinct from old.stars then
    new.score := new.stars * 2;
  end if;
  return new;
end;
$$;

drop trigger if exists ratings_score_from_stars on public.ratings;
create trigger ratings_score_from_stars before insert or update on public.ratings
  for each row execute function public.ratings_score_from_stars();
