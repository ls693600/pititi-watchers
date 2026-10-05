# CouchLog

The family TV log. Track shows by month, mark who watched, rate them individually, see the average, and mark rewatches. Runs as a web app added to the iPhone home screen.

- Show info (posters, seasons, episode counts) comes from [TVmaze](https://www.tvmaze.com/api). Free, no key.
- Sync between both phones uses [Supabase](https://supabase.com) (free tier).
- Without Supabase configured, the app runs in local mode: everything is saved on that one device.

## Run locally

```bash
npm install
npm run dev
```

```bash
npm test
```

## Database setup

Run the files in `supabase/migrations/` in order in Supabase > SQL Editor:

1. `001_initial.sql` — tables, security, live sync
2. `002_family.sql` — family members, per-person ratings, invite code

In Authentication > Sign In / Providers, turn off **Confirm email**. Put the Project URL and publishable key in `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_KEY=sb_publishable_...
```

The publishable key is meant to be public; row-level security only lets family members (people linked to an account) read or write.

## Family

- Settings > Family: add anyone you watch with (works without a phone).
- Settings > Invite code: share it. New people install the app, tap Create account, enter the code, and pick their name or type a new one. Without the code, sign-up is refused.
- Each log has **Watched by**. Only watchers rate it; the Average appears once all of them have rated.

## Put it on your phones

Live at **https://ls693600.github.io/pititi-watchers/** (GitHub Pages, `gh-pages` branch). Redeploy with `npm run deploy` (needs `.env.local`).

Then on each iPhone: open the link in Safari → Share → **Add to Home Screen**.

## How it works

- A log is one show + season in one month. A show lands in the month you last watched it ("+1 ep" moves it to the current month).
- Logging a show-season you've logged before turns **Rewatch** on automatically. You can switch it off.
- Tap a star again to clear your rating.
- Settings → **Export backup** downloads everything as JSON.
