# Dad Health — AI-assisted development handover

For whoever continues this codebase with Claude Code, Codex or a similar assistant. Read `AGENTS.md` and `claude.md` first; they hold the binding technical rules. This file covers setup, the working method, and what this milestone learned.

## 1. Repositories

| Repo | Role | Local folder (sibling) |
|---|---|---|
| `DadHealth-Mobile` | Expo / React Native app (iOS, Android) | `DadHealth-Mobile` |
| `dadHealth` | Next.js website and the shared backend: API routes, Supabase schema, migrations, cron, notification dispatch | `dadHealth` |

The backend owns scoring, calendars, entitlements, report snapshots and notification rules. The app consumes them; it must never recalculate them.

## 2. Minimum local setup

Mobile (Node 24, npm 11):

```bash
cd DadHealth-Mobile
npm ci                      # uses package-lock.json; runs patch-package
cp .env.example .env        # then fill in values from the project owner
npx expo start --clear      # dev server; a development build is needed for native modules
npm test                    # node --test "tests/*.test.mjs"
npx tsc --noEmit -p tsconfig.json
```

Backend (read the backend's own `AGENTS.md` before changing anything there):

```bash
cd dadHealth
npm ci
cp .env.local.example .env.local
npm run dev                 # http://localhost:8080
npm test
```

Some backend tests start a real PostgreSQL in Docker; with Docker stopped they fail with a Docker connection error. That is environmental, not a code fault.

## 3. Environment variables (names only — never commit values)

Mobile `.env` (all `EXPO_PUBLIC_*`, inlined into the app bundle, so never put a secret here):
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_URL`, `EXPO_PUBLIC_ONESIGNAL_APP_ID`, `EXPO_PUBLIC_APPLE_IAP_PRO_MONTHLY_PRODUCT_ID`, `EXPO_PUBLIC_APPLE_IAP_PRO_ANNUAL_PRODUCT_ID`, `EXPO_PUBLIC_GOOGLE_PLAY_PRO_PRODUCT_ID`, `EXPO_PUBLIC_GOOGLE_PLAY_PRO_MONTHLY_BASE_PLAN_ID`, `EXPO_PUBLIC_GOOGLE_PLAY_PRO_ANNUAL_BASE_PLAN_ID`, `EXPO_PUBLIC_GOOGLE_PLAY_PRO_MONTHLY_TRIAL_OFFER_ID`, `EXPO_PUBLIC_GOOGLE_PLAY_PRO_ANNUAL_TRIAL_OFFER_ID`, `EXPO_PUBLIC_ANALYTICS_ENABLED`.

Analytics is routed through the backend: the app never talks to PostHog. `EXPO_PUBLIC_ANALYTICS_ENABLED` only lets a consenting member's choice reach the backend (`/api/analytics/events`); it does **not** enable delivery to PostHog. Delivery is a separate backend switch (`ANALYTICS_DELIVERY_ENABLED`, default false) plus worker job 32 (inactive); both stay off until the privacy, export and deletion acceptance is complete. `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST` may still exist in old local `.env` files; no app code reads them, so do not rely on them.

Backend `.env.local`: see `dadHealth/.env.local.example`. It includes server secrets (Supabase service role, Stripe, Apple/Google subscription verification, OneSignal REST, Resend, cron and webhook secrets). Treat every one as confidential. The phone-push switch `ITEM03_EXACT_PUSH_ENABLED` is read by the backend but is not listed in that example file.

Rules: `.env*` files stay git-ignored; never paste values into prompts, commits, PRs, screenshots or issue trackers.

## 4. Safe working method

1. Inspect first: `git status`, the relevant code, and the tests that cover it. Preserve anyone else's uncommitted work.
2. Work on a feature branch from clean `main`. For parallel tasks, use one `git worktree` per branch so tasks never share a working tree:
   `git worktree add ../DadHealth-Mobile-<task> -b fix/<task> main`. A worktree has no `node_modules`; link or install it.
3. Scope exact files. Investigate the evidenced cause before changing code; no speculative fixes or unrelated refactors.
4. Treat auth, subscriptions, RLS, grants, migrations and scoring as sensitive. Mobile changes must not depend on backend changes unless both are approved.
5. Add or update tests that fail before the fix and pass after it. Never weaken an assertion to make a test pass. When a test pins code that legitimately moved, re-point it at the current code or test the behaviour directly, and say why in the test.
6. Run focused tests, then the full suite, then TypeScript. Compare failures **by test name** against `main` (section 6).
7. Review the full diff for unrelated changes, secrets and whitespace (`git diff --check`).
8. Commit only after the owner approves. Push, merge and deploy only after explicit authorisation.

Commits: one reviewable change per branch; message says what changed, why, and how it was verified.

PRs: description lists changed files, tests run with results, the comparison against `main`, device checks still needed, and any backend dependency.

## 5. When a native build or deployment is needed

| Change | What is needed |
|---|---|
| JavaScript/TypeScript, copy, layout, bundled assets (including Mind Reset audio) | A development build picks it up from the dev server. Testers need a new build: no OTA updates are configured (`expo-updates` is not installed) |
| `app.json`, Expo plugins, native modules, permissions, entitlements, OneSignal mode | A new native build (EAS). Push only arrives on TestFlight/App Store builds, because OneSignal uses `mode: "production"` |
| Backend routes, SQL, cron, environment values | Backend deployment and possibly a migration — backend repo, separate approval |
| Store products, prices, trials, offers | App Store Connect / Play Console — owner-controlled |

## 6. Tests and the baseline

- Mobile tests are `node --test` files in `tests/`. Many load TypeScript modules into a `vm` sandbox with mocked imports, so a new `import` in a module needs a matching mock in its test harness ("Unexpected dependency/import" errors).
- `main` (`b1e7625`, 2026-11-23) does **not** pass cleanly: 577 of 688 pass. Always compare against `main` by test name, not by count.

```bash
node --test "tests/*.test.mjs" > after.txt 2>&1
grep -E "^✖ " after.txt | grep -vE "tests\\\\|tests/|failing" | sed -E 's/ \([0-9.]+ms\)//' | sort -u > after-fails.txt
comm -13 main-fails.txt after-fails.txt    # newly failing — must be empty
```

- Line endings (`core.autocrlf=true` on Windows) did not change the current suites' results. A new test that matches exact multi-line source text can still be line-ending sensitive: match line breaks with `\s` or `\r?\n`.

## 7. Reusable bug-fix prompt

```text
Repository: DadHealth-Mobile (backend dadHealth is read-only unless I say otherwise).
Read AGENTS.md, claude.md and docs/AI_HANDOVER.md first.

Bug: <what the user sees, where, for which account type (Free/Pro/trial), platform>.
Expected: <what should happen, quoting the brief or approved decision>.

1. Investigate only: find the code path and the evidenced root cause. Check the backend
   contract read-only if the app depends on it. Report before changing anything.
2. If the fix is mobile-only and approved: create a branch and worktree from clean main,
   change only the necessary files, and add a test that fails before and passes after.
3. Run focused tests, the full suite and TypeScript; compare failures by name with main.
4. Report: root cause, files changed, test results, new failures (must be none),
   device checks still needed, backend dependencies, decisions needed.
Do not commit, push, merge or deploy until I approve.
```

## 8. Verification and hand-off template

```text
Change: <one line>
Branch / commit: <branch> / <hash or "uncommitted">
Root cause: <evidence, file:line>
Files changed: <list>
Tests: focused <n/n>; full suite <pass>/<total>; new failures vs main <0 or list>; TypeScript <status>
Behaviour preserved: <what was checked to be unchanged>
Device checks: <done on which device, or NOT RUN / BLOCKED and why>
Backend dependency: <none, or exact change needed>
Decisions needed: <none, or the question>
```

## 9. Known issues and resolved root causes (Milestone 3)

Resolved on local branches (pending client review):

| Area | Root cause | Fix |
|---|---|---|
| Paywall | CTA wording differed from the brief; no trial-end or first-payment date | Brief CTA; dates from the store's 7-day offer, computed as purchase instant + 7×24 h (not calendar days, which fail across clock changes) |
| Weekly report | Sheet ignored the error and Retry it received; "not released" and "missing" were merged | Plain error messages with Retry; distinct empty states |
| Streak | Protected days shown as raw ISO dates | Readable, timezone-stable labels |
| Scores | New accounts' valid scores were hidden until a full baseline week; a missing score could render as 0 | Scores from day one, trends still wait; missing shows "—" |
| Score refresh | No refresh after workouts; journal sync refresh branch unreachable | Refresh after confirmed saves |
| Reminder time | One misleading error message for range and 15-minute-step failures | Accurate messages; shared list of the 52 valid times |
| Mind Reset sound | 7.5 s recording with unknown licence repeated every 10 s, out of step with 4-4-4 breathing | Original synthesised bell at each minute |
| Tests | About 20 notification and deep-link tests pinned moved code or missed new imports | Re-pointed to current behaviour |

Open (detail lives in the milestone investigation record kept outside the repository; nothing here depends on it):
- (Resolved since: Mind Reset completions are recorded through `complete_mind_reset`; 60 s+ "Finish here" counts, with offline and keychain recovery; see `lib/mindResetCompletion.ts`.)
- Account timezone defaults to UTC and is not taken from the device (owner decision; it also moves the scoring calendar).
- Backend-dependent: phone-push switch, Apple-only trial notice and its copy, lowest-pillar trigger, 50% retention offer, badge awarding, Mind plan server logging, database load, Dad Days failures, analytics delivery.

Disproved theories — do not repeat:
- "Line endings cause the test failures" — identical results on LF-only clones for the current suites (see section 6 for new tests).
- "The reminder picker allows any minute" — the check-in reminder uses a fixed 15-minute list on both platforms; only the native picker for other timed types allows any minute.
- "Bedtime story, workout window and journal prompt are never sent" — the backend's legacy dispatch loop sends them.
- "Saved activities don't update scores because the client doesn't refresh" — the activity log screen does refresh; the visible cause was the baseline rule hiding scores for new accounts.
