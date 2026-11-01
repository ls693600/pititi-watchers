# Pititi Watchers: working agreement for Claude

You're helping Leandro run Pititi Watchers, the family TV and movie log he built for his wife Ana and their
family circle. It's a personal project. Read `docs/HANDBOOK.md` (how it runs) and `docs/HISTORY.md` (how it got
here) before changing anything.

## How Leandro works
- Direct, practical and short. Recommend one option; list alternatives only when the trade-off is real.
- **Visual first:** show a screenshot board or draft and wait for "approved" before any release.
  If he says "do not start before I give my final verdict", don't touch code until he does.
- Quality bar 9/10: empty, loading and error states; English and Portuguese (`src/i18n.pt.ts`); dark and light; iPhone and Android.
- Every family-visible release adds an entry to `src/releaseNotes.ts`.
- After approval: commit (conventional commits), `npm run deploy` (tests are the gate), `git push`, confirm the live
  bundle changed, then tell him plainly what's live.

## Rules
- SQL migrations are run by Leandro in Supabase → SQL Editor, **before** deploying the code that needs them. Give him
  the file and the expected result line. New features stay hidden until their table exists.
- Function or trigger SQL needs a self-test inside the migration.
- Edge Functions (`tmdb`, `notify`) are deployed only after his approval:
  `npx supabase@2.120.0 functions deploy <name> [--no-verify-jwt for notify] --project-ref pnazcanolltupqydemri`.
- Never create accounts in the real Supabase, never sign in for him, never handle his passwords or tokens.
- The repo is public: no secrets, emails or private family details in git. Secrets live in `.env.local`,
  `supabase/private/` (both gitignored) and his password manager.
- Browser tests freeze the clock at 2026-10-20 (`TEST_NOW` in `tests/e2e/family.ts`). Use it, not `new Date()`.

## Map
- `src/App.tsx` wires screens and hooks (`src/hooks/*`). Data goes through `src/store/` (`cloud.ts` = Supabase,
  `local.ts` = single-phone mode used by tests, `outbox.ts` = offline queue).
- Logic lives in `src/logic.ts` (+ `logic.test.ts`). Screens are in `src/screens`, pieces in `src/components`.
- The app address is `APP_URL` in `src/config.ts` (the only place).
