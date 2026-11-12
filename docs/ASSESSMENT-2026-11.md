# Pititi Watchers: full assessment (Nov 11, 2026)

**Target: 9.5/10 in every dimension.** Scores are evidence-based: from the code, the test suites, the build and
the live app. They are not inflated. Overall today: **8.4/10**. Strong product, behind on the engineering foundations.

## Scorecard

| Dimension | Today | Evidence | Main gap to 9.5 |
| --- | --- | --- | --- |
| Product and feature depth | **9.3** | Month log, blind ratings + reveal, family circle, chat, push, reactions, photos, Year in Review, picks, It's back, festive looks | A few signature "only Pititi does this" moments still on the backlog |
| Usability | **8.4** | Fast logging (Quick mark), Undo everywhere, clear empty states | The phone's **back gesture doesn't close sheets or go back** (no history navigation). Long-press actions are hidden. Home is getting crowded |
| UI and visual design | **8.9** | Coherent warm theme, dark mode, festive skins, polished sheets | Sheets keep getting taller; no shared motion between screens; the typography scale has drifted |
| Accessibility | **8.0** | Labels on almost every control, reduced-motion support, Escape closes things | No automated accessibility check, color contrast never measured, some states shown by color only |
| Performance | **7.4** | Caches for show info and picks; images lazy-loaded | **One 860 KB JavaScript file (249 KB compressed)** loads everything on first open; no code splitting |
| Architecture and maintainability | **7.8** | Clean store layer (cloud / local / offline queue), pure logic with unit tests, row-level security everywhere | `App.tsx` (1,020 lines) and `logic.ts` (1,238 lines) do too much; screens aren't in the URL; database row types are hand-written |
| Reliability and operations | **7.3** | Offline queue, crash screen, problem reports, release gate in `deploy.sh` | **No CI**: tests only run on one laptop. SQL is run by hand. No alert if the push or evening reminder jobs stop. Backups are manual |
| Security and privacy | **8.5** | Row-level security, private photo bucket with expiring links, server-held keys, invite codes | Public repo leaked an invite code (fixed). Invite codes don't expire. Database rules have no automated tests |
| Quality and testing | **8.4** | 168 unit + 142 browser tests on iPhone and Android engines, frozen clock | Nothing tests the real Supabase (rules, triggers, functions); no visual regression; no accessibility tests |
| Modernity | **8.8** | React 19, Vite 8, TypeScript 6, installable app, Web Push, offline | Missing view transitions, app icon badge, share-to-Pititi, home-screen quick actions on iPhone |
| Language (EN/PT) | **8.7** | 1,100 Portuguese strings, genres and statuses in plain words | Show synopses come from TVmaze in English only; dates and numbers mostly localized |
| Delight and stickiness | **9.0** | Reveal moment, confetti, Year in Review, couch photos, episode reactions | No streaks or rituals that pull the family back every week |

## What it takes to reach 9.5 everywhere

Ordered by impact. Each item names the evidence that proves it's done.

### Phase A: foundations (the biggest score jumps, ~1 week of work)

1. **Back gesture and URLs** (Usability +0.6, Architecture +0.3). Every screen and sheet gets a URL, so the Android
   back button and the iPhone edge swipe close the sheet instead of leaving the app. Links can open any show directly.
   *Done when:* browser tests press Back on every sheet and screen.
2. **Split the app into pieces** (Performance +1.2). Stats, Year in Review, Settings, festive data and the Portuguese
   dictionary load only when needed. Target: under 120 KB compressed on first open, measured with Lighthouse on a
   mid-range phone. *Done when:* the build report shows the split and Lighthouse scores 90+.
3. **CI on GitHub** (Reliability +0.8, Quality +0.3). Unit tests, browser tests, type check and lint run on every push,
   and deploys only happen from a green run, not from a laptop. *Done when:* a failing test blocks a release by itself.
4. **Database tests** (Security +0.5, Quality +0.5). A local Supabase in CI runs every migration from scratch and checks
   the rules: another household can't edit your logs, a viewer can't upload photos, a stranger can't read anything.
   *Done when:* a test suite covers every policy in migrations 001–014.
5. **Accessibility audit** (Accessibility +1.0). Automated axe checks in the browser tests, measured contrast on both
   themes, and no state shown by color alone. *Done when:* zero axe violations on every screen.

### Phase B: product polish (~1 week)

6. **A calmer Home** (Usability +0.3, Design +0.2). Collapse It's back, Picks and festive cards into one "Tonight"
   area with the one most useful card on top, and let the family hide sections.
7. **Visible gestures** (Usability +0.2). A one-time hint for long-press, plus a visible "⋯" on every poster.
8. **Shared motion** (Design +0.3, Modernity +0.3). View transitions: the poster grows into the show page and the
   sheet into full screen.
9. **Portuguese synopses** (Language +0.5). Pull the overview from TMDB in Portuguese when TVmaze only has English.
10. **Operations alerts** (Reliability +0.4). If the 21:00 reminder job or the push function fails, Leandro gets a
    notification, and a weekly automatic backup goes to private storage.

### Phase C: stand-out features (what no other tracker has)

| Feature | Why it stands out |
| --- | --- |
| **Predictions** (agreed next) | Sealed guesses opened by the episode itself; a season-long scoreboard between the two of you |
| **Swipe match: decide together** | Both phones swipe posters and the first mutual yes wins. Ends the 20-minute "what do we watch" |
| **"We have 45 minutes"** | Pick your time; Pititi shows what fits tonight from shows in progress and your lists |
| **Watch party across households** | Start at the same time in two homes, with a shared chat that holds spoilers until both reach the scene |
| **On this day** | "One year ago you started Severance", with that night's couch photo |
| **Family Wrapped video** | The Year in Review exported as a short vertical video for WhatsApp |
| **Share to Pititi** | Share a trailer or Instagram post from any app straight into a Pititi list |
| **App icon badge + iPhone quick actions** | Unread chat count on the icon; long-press the icon to jump to Quick mark |

## Rating after each phase (my estimate)

| | Today | After A | After A + B | After A + B + C |
| --- | --- | --- | --- | --- |
| Lowest dimension | 7.3 | 8.8 | 9.3 | 9.5 |
| Overall | 8.4 | 9.0 | 9.4 | 9.6 |

Phase A has the most impact: it fixes things the family feels (the back button, speed) and things only you
feel (releases that don't depend on one laptop, rules nobody tests). I recommend doing it before adding more features.
