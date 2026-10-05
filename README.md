# CouchLog

Leandro and Ana's TV log. Track shows by month, rate them separately, see the average, and mark rewatches. Runs as a web app added to the iPhone home screen.

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

## Turn on sync (one-time, about 10 minutes)

1. Create a free account at supabase.com and a new project (any name, pick the closest region).
2. **SQL Editor** → paste the contents of `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user** → create one user for Leandro and one for Ana (email + password, tick "Auto confirm").
4. **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up". Only your two accounts can exist.
5. **SQL Editor** → link each account to a person (copy the user IDs from the Users page):

   ```sql
   insert into public.members (user_id, person) values
     ('<leandro-user-id>', 'p1'),
     ('<ana-user-id>', 'p2');
   ```

6. **Project Settings → API** → copy the Project URL and the anon / publishable key into `.env.local`:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_KEY=your-anon-or-publishable-key
   ```

   The anon key is meant to be public. Your data is protected by the row-level security rules in `schema.sql`, which only allow the two member accounts.

## Put it on your phones

The phones need a public HTTPS address. Free options: Vercel, Netlify, or Cloudflare Pages. Build command `npm run build`, output folder `dist`, and add the two `VITE_SUPABASE_*` values as environment variables in the host.

Then on each iPhone: open the link in Safari → Share → **Add to Home Screen**.

## How it works

- A log is one show + season in one month. A show lands in the month you last watched it ("+1 ep" moves it to the current month).
- Logging a show-season you've logged before turns **Rewatch** on automatically. You can switch it off.
- **Average** only appears once both of you have rated. Tap a star again to clear your rating.
- Settings → **Export backup** downloads everything as JSON.
