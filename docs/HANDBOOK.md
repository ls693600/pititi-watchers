# Pititi Watchers: operations handbook

Everything needed to run, change, release, back up and move the app. No secrets are in this file or the repo.
They are listed by name below with where each one lives.

## 1. What it is

A family TV and movie log, installed from the browser to the home screen (a PWA). It's used by four households
in one family circle: Leandro & Ana, Fernando & Lara, Eduarda & Thiago, and Pero & Marcia, plus viewers.
It's in English and Portuguese, and the owner and admin is Leandro.

| Piece | What | Where |
| --- | --- | --- |
| App | React 19 + Vite + TypeScript, static files | GitHub Pages, branch `gh-pages` of this repo |
| Address | `https://ls693600.github.io/pititi-watchers/` | `APP_URL` in `src/config.ts` (one place) |
| Data + sign-in | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, pg_cron, Vault) | Project ref `pnazcanolltupqydemri`, free plan |
| Show data | TVmaze public API (no key) | Called from the phones |
| Movies, trailers, picks | TMDB, through the `tmdb` Edge Function (key stays on the server) | `supabase/functions/tmdb` |
| Push notifications | Web Push (VAPID) sent by the `notify` Edge Function | `supabase/functions/notify` |
| Scheduled jobs | pg_cron: `pititi-reminders` 21:00 UTC daily, `pititi-evening` hourly | Created by migrations 007 and 011 |

## 2. Accounts the app depends on

| Account | Used for | Notes |
| --- | --- | --- |
| GitHub `ls693600` | Code, hosting (Pages) | The account also holds work repos; see the transition plan |
| Supabase (Leandro's personal Google account) | Database, sign-in, photos, functions | Free plan; turn on 2FA |
| TMDB (themoviedb.org) | API Read Access Token used by the `tmdb` function | Stored only as a Supabase secret |
| Domain registrar (optional, future) | A custom domain so the address never depends on a GitHub account | See section 7 |

## 3. Secrets: names and where they live (never in git)

| Name | Where it's used | Where the value is kept |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` | Build (`.env.local`). The publishable key is public by design; row-level security protects data | `.env.local` (gitignored) + password manager |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push. The public half is also in `src/config.ts`. **Losing the private half means every phone must turn notifications on again** | Supabase function secrets + `supabase/private/keys.json` + password manager |
| `PITITI_HOOK_SECRET` | Lets the database call `notify` (also stored in Vault as `pititi_hook_secret`) | Supabase function secrets + Vault + `supabase/private/` + password manager |
| `TMDB_TOKEN` | `tmdb` function | Supabase function secrets; recoverable from the TMDB account settings |
| Supabase database password | Backups (`db dump`) | Supabase dashboard (can be reset) + password manager |
| `APP_URL` (optional) | `notify` contact address; only needed if the app moves | Supabase function secrets |

## 4. Day-to-day

```bash
npm install          # once per machine
npm run dev          # local, single-phone mode when .env.local is absent
npm test             # unit tests (vitest)
npm run test:e2e     # browser tests on iPhone Safari + Android Chrome engines (clock frozen at 2026-10-20)
npm run deploy       # unit + e2e gate → build → push dist/ to gh-pages
```

Git push from a machine whose keychain has another GitHub user: run this first, then `npm run deploy` and `git push`:

```bash
export GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=credential.https://github.com.helper GIT_CONFIG_VALUE_0= GIT_CONFIG_KEY_1=credential.https://github.com.helper GIT_CONFIG_VALUE_1='!gh auth git-credential'
```

After a deploy, GitHub Pages can take a few minutes. Check the live `assets/index-*.js` name changed, or run
`gh api -X POST repos/<owner>/pititi-watchers/pages/builds` to nudge it.

### Automatic checks (CI)

Every push to `main` runs `.github/workflows/ci.yml` on GitHub:
- **checks:** type check, lint, unit tests.
- **e2e:** all browser tests (iPhone + Android engines, plus the sign-in screens). This includes `tests/e2e/accessibility.spec.ts`
  (axe, WCAG 2.1 AA on every screen, light and dark) and `back-gesture.spec.ts`.
- **database:** builds a throwaway Supabase from migrations 001–014 and runs `supabase/tests/rls.test.sql`
  (who can read and change what). A new migration must keep it green; add a check there for every new table or rule.

Don't deploy with a red run: `gh run list -R ls693600/pititi-watchers --workflow CI --limit 1`.

## 5. Database changes (migrations)

`supabase/migrations/001…014` were all run in order in **Supabase → SQL Editor** (by Leandro, by hand).

Rules learned the hard way:
- Run the SQL **before** deploying the app that needs it. New features check that their table exists and stay hidden until then.
- Any function or trigger change needs a self-test inside the migration. Sign-up broke after 008 (`010_fix_join.sql`), and the browser tests can't catch Supabase triggers.
- `007_secret.sql` (Vault secret) is in `supabase/private/`, never in git.
- Migration 007 has the project's function URL typed in (`…supabase.co/functions/v1/notify`). In a new project, change it before running.

| # | What it adds |
| --- | --- |
| 001 | Tables, row-level security, live sync |
| 002 | Family members, per-person ratings, invite code |
| 003 | Single admin |
| 004 | Up Next |
| 005 | Episodes per month |
| 006 | Rating reactions + chat |
| 007 | Messages, push subscriptions, pg_net + pg_cron reminders, viewers |
| 008 | Households (family circle), movies, lists with privacy, votes, recommendations |
| 009 | Error reports (admin "Problems") |
| 010 | Fix: sign-up after 008 |
| 011 | Evening reminder (hourly cron) |
| 012 | Ratings out of 10 |
| 013 | Episode reactions |
| 014 | Couch photos (private bucket `couch-photos` + table) |

Supabase settings that are **not** in SQL (set them by hand in a new project):
- Authentication → Sign In / Providers → **Confirm email: OFF**.
- Authentication → URL Configuration → **Site URL** = the app address; **Redirect URLs** = `<app address>**`.
- Edge Functions: `npx supabase@2.120.0 functions deploy tmdb --project-ref <ref>` and `… deploy notify --no-verify-jwt --project-ref <ref>`.
- Function secrets: `npx supabase secrets set NAME=value --project-ref <ref>` for each secret in section 3.

## 6. Backups (do monthly, and before leaving any job)

The free plan has no downloadable backups. Three things to keep:

1. **Code**: GitHub, plus an offline `git bundle` (`git bundle create pititi.bundle --all`).
2. **Database**, schema and data. In Supabase → Project Settings → Database, copy the connection string, then:
   ```bash
   npx supabase@2.120.0 db dump --db-url "$DB_URL" -f backup/schema.sql
   npx supabase@2.120.0 db dump --db-url "$DB_URL" --data-only -f backup/data.sql
   ```
   (`$DB_URL` is the `postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres` string with your database password.)
   Settings → **Export backup** in the app also downloads the logs as JSON (a second, simpler copy).
3. **Photos**: Supabase → Storage → `couch-photos` → download. Or, with the CLI logged in and the project linked:
   ```bash
   npx supabase@2.120.0 storage cp -r ss:///couch-photos backup/photos --experimental
   ```

## 7. Moving the app (new GitHub account or a custom domain)

The address is the identity of the installed app on every phone. Changing it means each person opens the new
link once and adds it to the home screen again. Their data is safe (it lives in Supabase), but they need to sign
in once and turn notifications on again. Do it once, on purpose, and tell the family first.

1. In `.env.local`, set `VITE_APP_URL=https://<new address>/`. Or change the default in `src/config.ts`; it's one line.
2. Supabase → Auth → URL Configuration: add the new Site URL and Redirect URL. Keep the old ones until everyone has moved.
3. `npx supabase secrets set APP_URL=https://<new address>/ --project-ref <ref>`, then redeploy `notify`.
4. If the repo moved accounts: `git remote set-url origin https://github.com/<new owner>/pititi-watchers.git`.
   `npm run deploy` pushes wherever `origin` points. Enable Pages on the new repo (branch `gh-pages`, root).
5. Leave the old address showing a "We moved" page with the new link. Push it to the old repo's `gh-pages`, if you
   still control it, before you lose access.
6. Test the invite link, sign-in, a push notification, a trailer and a photo upload on a real phone.

With a **custom domain** (for example `pititi.app`, about US$10–20 a year): add a `CNAME` file containing the
domain to `public/` and point the domain's DNS at GitHub Pages. After that, the address never depends on which
GitHub account hosts it again.

## 8. How we work (the agreements behind every release)

- Visual drafts (screenshot boards) first. Nothing ships without Leandro's "approved".
- A quality bar of 9/10: real states (empty, loading, error), English and Portuguese, dark and light, iPhone and Android.
- Every release the family would notice gets an entry in `src/releaseNotes.ts` (Home shows it once).
- Unit and browser tests are added with each feature. `npm run deploy` refuses to publish if any test fails.
- SQL is run by Leandro in the SQL Editor before the release. Edge Functions are redeployed only after approval.
- Never create test accounts in the real Supabase: they'd show up as family members.
