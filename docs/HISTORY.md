# Pititi Watchers: project history

From the first idea (Oct 5 2026) to now. Built by Leandro with Claude Code. Every change is in git
(`git log`). This document is the story behind it: what was built, why, the decisions made and the incidents.

## How it started (Oct 5)

- **The ask:** "a mobile app for me and my wife". They watch a lot of TV on an IPTV box and wanted to track
  shows by month, rate them and mark rewatches. Visuals first, before any code.
- **Decision: no IPTV import.** The IPTV player apps (UniTV, Watchlist Pro) have no API, so logging is manual and has to be fast.
  Show data comes from TVmaze (free, no key). IMDb has no public API.
- **Decision: a free web app on the home screen,** not a US$99/year native app. Both use iPhones.
- **Decision: Supabase for sync** (free), on Leandro's personal account. The repo is public, because free GitHub Pages
  requires it. It holds no secrets.
- Named **CouchLog**, then renamed **Pititi Watchers** the same day.

## Oct 5: first version and three rounds in one day

| Commit | What shipped |
| --- | --- |
| `9ce251b` | Month-based TV log, per-person stars, average, rewatch toggle |
| `a28e90a` `5ba22a3` | Rename, in-app sign-up, GitHub Pages deploy (`gh-pages` branch) |
| `7baf2f8` | Stats per month and year, log into any month |
| `3201da1` | Family members, invite code, per-person ratings (migration 002) |
| `110a555` | "Warm cinema" light redesign, single admin (003) |
| `090d4ac` | **Round 1:** quick log, blind rating with a reveal moment, evening dark mode |
| `2ea9a66` | **Round 2:** Up Next with Tonight's pick, a real show page (004) |
| `1613ce7` | **Round 3:** taste match and family badges |
| `7022011` … `5ef058d` | Never count unaired episodes, in-app Help, Currently watching shelf, per-month episode counting (005), release banner |

## Oct 11–12: the family circle

- Fixes: honest episode marking, merging duplicates, per-person stats, share cards.
- **Quick actions** (press and hold), **Undo everywhere**, **rating reactions and chat** (006).
- **Update banner,** because phones were stuck on old versions (Pages cache plus iOS resume).
- **Watching together,** where to watch, @mentions, **Year in Review** story.
- **Messages tab,** Family chat, **push notifications** (Web Push, `notify` function, pg_cron, Vault) (007).
- **Viewers:** can see everything and chat, but can't change shows (for the brother-in-law on Android).
- **Households (family circle),** movies (TMDB through the `tmdb` function), lists with privacy, votes, recommendations (008).
  Four households.
- **Portuguese and English,** festive looks.
- **Quality:** Playwright browser tests on iPhone and Android engines, made a gate in `deploy.sh`. App.tsx split into modules.
  Offline saving queue, problem reports (009), crash screen.
- **Incident:** sign-up was broken for every new account after 008 (a plpgsql variable bug), fixed by `010_fix_join.sql`.
  **Lesson:** every SQL function or trigger change ships with a self-test.

## Oct 14–22

- **Quick mark** ("What did you watch today?"), **evening reminder** (011), Android icon shortcuts.
- Change password in Settings, plus a forgot-password email link. The Supabase Site URL was fixed on Oct 21: reset emails pointed to localhost.
- **Trailers** from posters and the Add sheets, in a cinema-style pop-up.
- Month tiles open the list of what was watched; Family chat strip on Home.

## Oct 25–26

- Festive picks, Halloween night look, ambient effects.
- **Ratings out of 10, one per show** across seasons (012, existing ratings doubled).
- Home: **Together vs alone** month view, one poster per show, **What's new** after updates.
- **Incident:** another household's show was flagged "logged twice" and merged into ours. Duplicate checks are now household-scoped, and a repair card cleans it up.
- Canadian and Brazilian commemorative dates, for every phone.

## Oct 28–31

- **Picks of the week** (TMDB trending, drifting rail).
- **It's back:** news on finished shows (new season, date, renewal, ended), a premiere-day push, and **For us**
  recommendations from titles rated 8+.
- Shows and movies counted apart everywhere: Home tiles, month sheet, yearly totals, share pictures, stacked monthly chart.
- Ideas considered and declined: a spoiler shield. Each household watches together, so it isn't needed.
- **Episode reactions** 🤯 😭 😂 😍 🥱, best episode per season, Episode of the year (013).
- **Couch night photos** with a private bucket, signed links and a Year in Review album (014).

## Nov 1: portability

- The app address became a single setting (`APP_URL`), and deploy pushes to whichever repo it was cloned from.
- Browser tests freeze their clock at 2026-10-20. Before that, every month-based test started failing on Nov 1.
- Handbook, history, CLAUDE.md and a portability package were prepared for continuing outside the work computer.

## Not built yet (agreed backlog)

- **Predictions:** sealed guesses opened when the episode is logged, visible only to your household.
- Ideas from the list of 12: swipe match (decide together), "we have 45 minutes", whose turn it is to pick, theme night roulette,
  On this day, comfort shows, calendar of nights, cinema dates, franchise progress.
