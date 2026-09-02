# CLAUDE.md — DadHealth Mobile

# Project Rules

## Production Error Copy

- Every user-facing error must name the affected feature or action and give the
  user a useful next step.
- Never show implementation or development details in the client, including
  internal provider names such as Supabase or OneSignal, storage mechanisms,
  native modules, API/schema/database details, tokens, environment variables,
  build instructions, Expo Go, stack traces or raw caught error messages.
- Map failures to stable, production-ready copy before rendering them. Do not
  ship temporary console diagnostics, diagnostic panels or implementation-state
  labels in production builds.
- Screen-level load errors must name the current screen or content. Do not reuse
  Dashboard wording on Body, Mind, Bond, Squad, Progress or settings screens.
- Do not use placeholder error copy such as "Something went wrong" or "An error
  occurred." State what failed and what the user can do next.

## Error Surfaces

There are exactly three places an error may appear. Pick by the kind of error,
never by convenience.

1. **Top status banner** — `components/OfflineStatusBanner.tsx`.
   Reserved for persistent global conditions only. Today that means offline
   mode. It is driven by connectivity state, not by a timer, so it stays visible
   for as long as the condition is true. Never put form validation, save
   failures or normal API errors in it. Do not add a second top banner.
2. **Inline, next to the field or action** — `components/InlineFormError.tsx`.
   All form errors live here: validation messages and the failure of the action
   the user just triggered (save, post, generate, invite, connect, purchase).
   Place the slot beside the relevant field or directly above/below its button,
   not at the top or bottom of the screen. Use `surface="lime"` on the lime
   check-in surface.
3. **Bottom snackbar** — `components/GlobalConnectivityToast.tsx`, reached via
   `GlobalErrorToastReporter` or `showErrorNotice`. Small, bottom-anchored,
   auto-dismissing after 4 seconds, and clear of the bottom navigation. Use it
   for temporary request failures: screen-level load failures, background
   refresh and sync failures, per-row request failures and short connectivity
   transitions.

Screens that mix both kinds keep separate state per surface — for example
`loadError` on the snackbar and `eventError` inline — rather than routing one
string to whichever surface is closest.

### Clearing stale errors

An error must be cleared as soon as it can no longer be true:

- **Edit** — clear the inline error in the field's `onChangeText` / option
  `onPress`, so correcting an input removes the message.
- **Retry** — clear before the request starts, at the top of the action.
- **Refresh** — pull-to-refresh calls `dismissToast()` before refetching
  (`PillarScreen` and `DashboardScreen` already do).
- **Success** — clear on the success path, never leave the previous failure on
  screen next to a fresh result.
- **Reconnect** — `NetworkProvider` drops any pending failure notice when
  connectivity changes.

## Body Layout and Section Composition

The Body screen is the reference layout. Feature sections are flat and read in
this order:

`label → heading → supporting copy → action → divider`

The divider is a `border-b border-border` on the section itself. Do not wrap
AI Workout, Meal Planner, TDEE or comparable features in large bordered or
elevated cards. Apply the same composition to feature sections on the other
pillar screens (Bond already uses it for the co-parenting calendar and
milestone tracker). Compact navigation rows and stat tiles keep their existing
mockup treatment; this rule is about feature sections with their own action.

The bottom navigation is fixed. Keep all five tabs and the raised Today tab
exactly as they are.

## Pro Conversion

Jamie's rule governs every Pro surface: **do not sell Pro, demonstrate it.**
Free → useful → curiosity → personalised insight → Pro.

### The three Pro surfaces

1. **`components/ProUpgradeSection.tsx`** — an upgrade moment as a flat native
   section (label → heading → supporting copy → action → divider). The label
   text leads and the lock is a small trailing glyph, because a lock is never
   the first thing on a screen. `size="sm"` when it sits inside another section.
2. **`components/ProLockedPreview.tsx`** — a Pro feature rendered dimmed and
   non-interactive behind a lock, with the label, copy and action below it.
   Never block a feature without showing a preview of what is behind the lock.
3. **`screens/subscreens/ProSubscriptionScreen.tsx`** — the only place Pro is
   sold. Annual first, 7-day trial, "Make Dad Health personal", three things a
   dad gets this week. It is a pushed screen, never an initial route, so the
   paywall never appears on first open.

All Pro copy lives in `lib/proMoments.ts` (`PRO_MOMENTS` for the seven upgrade
moments, `PRO_LOCKS` for the feature-split locks). Add or reword Pro copy there,
not in a screen, so the wording stays consistent and testable.

### The seven upgrade moments

| # | Moment | Where |
| - | ------ | ----- |
| 1 | `score` | Today, under the Dad Health Score (`UpgradeProCard`) |
| 2 | `checkIn` | Today, after the daily check-in (`CheckInFollowUp`) |
| 3 | `aiWorkout` | Body screen section and AI Workout screen |
| 4 | `dadDays` | Dad Days search, above the search action |
| 5 | `weeklyReport` | Today on Sundays, and always on Progress |
| 6 | `progressTrends` | Progress, under the score card |
| 7 | `dadDaysCounter` | Dad Days search, under the search action and at the limit |

Moment 2 always renders one genuinely useful free recommendation
(`lib/checkInRecommendation.ts`) *above* the Pro line. Moment 1 leads with the
dad's own improvement via `proScoreTease`, and falls back to the generic wording
rather than inventing progress. Moment 7 is worded as searches **used**, not
remaining.

### Free vs Pro split as implemented

| Area | Free | Pro |
| ---- | ---- | --- |
| Mind | Breathing, journal, therapist directory, crisis button | Personalised Mind plan tease, mood trends |
| Body | Workout library, TDEE core numbers and maintenance target | AI Workout, full TDEE target ladder and insights, meal planner |
| Bond | Milestone logging (text, date, tag), 3 Dad Days searches a month | Milestone photos, personalised Dad Days, unlimited searches |
| Score | Total score, pillar bars, week-on-week arrows | Weekly report, pillar breakdown on Progress, recommendations |
| Reports | None | Weekly report, monthly report and its share/PDF |
| Community | Full access | Full access |

The therapist directory and milestone logging are **free** — do not re-gate
them. Every Pro lock in this table renders over a visible preview.

### Streak protection

Streak protection is a Pro benefit. `countStreakDays` in `lib/offlineSync.ts`
forgives exactly one missed day for a Pro member and breaks on the first gap for
everyone else. It uses the existing `user_streaks` row — no schema change — and
a failed profile read degrades to the free rule rather than failing the
check-in. `StreakCard` states the protection for Pro and teases it for free.

### Weekly report

`lib/weeklyReport.ts` builds the report from the dad's own week-on-week changes
and month workout count. It returns `null` when there is no week-on-week data,
and the card then says so. Free members see the real layout with em dashes —
never fabricated percentages.

## Source of Truth

### Web App = WHAT to build

Use the web app as the source of truth for:

- Features
- Business logic
- Calculations
- Supabase queries
- Copy

### App Store Mockups = HOW to build it

Use the mockups as the source of truth for:

- Layout
- UI
- UX
- Visual hierarchy
- Spacing
- Typography
- Component styling

Never copy the web layout or visual hierarchy onto mobile.

Every mobile screen must feel like a native app built from the mockups while preserving the web functionality.

---

# Migration Workflow

Never migrate an entire screen at once.

Break every screen into small components.

Example

Fitness

- Header
- Statistics
- Workout Card
- Workout Timer
- Workout Library
- Meal Planner
- TDEE
- Loading / Empty / Error States

Each component follows this workflow.

1. Read the web component.
2. Explain exactly what it does.
3. Compare it with the current mobile implementation.
4. Recommend one of:

- Keep
- Modify
- Remove
- Replace

5. Wait for me to explicitly say **Approved**.
6. Only then enter coding mode.
7. Update **only** the approved component.
8. Explain exactly what changed.
9. Return to review mode.
10. Continue with the next component.

Never implement multiple components without approval.

If you finish implementing an approved component, immediately return to review mode.

Never continue coding until another approval is given.

---

# Migration Principles

Migration is **not** redesign.

If a web feature doesn't naturally fit mobile:

- Keep the feature.
- Reorganize it using the mockup design language.
- Do not copy the web layout.

Never remove features.

Never invent features.

Never redesign business logic.

If something is a product issue rather than a migration issue:

- Record it under **Deferred Product Improvements**.
- Continue the migration.

If uncertain:

Stop.

Ask.

Never assume UI, product behavior or data.

---

# Current Status

## Milestone 3 — Native Integrations

In progress.

- M3.1 Push Notifications is implemented with OneSignal, authenticated user
  linking, notification preferences, native tap routing, concurrency-safe daily
  limits and event-specific idempotency. Community reply and co-parent event
  delivery have been verified end to end; scheduled and completion notification
  QA uses the production dispatcher and claim system.
- M3.2 Apple HealthKit is implemented as a read-only integration for Steps,
  Active Minutes, Resting Heart Rate and Sleep, using the existing wearable,
  Fitness, Progress and score architecture.
- M3.3 Google Health Connect is implemented. Signed Android and production QA
  will run near the end of M3.
- M3.4 Native Subscriptions is implemented. Apple and Google external store
  configuration will be completed separately as access becomes available.
- M3.5 Offline Mode is implemented with user-scoped caches, queued Home and
  Journal writes, reconnect sync and one centralized connectivity experience.
- M3.6 Deep Links is implemented for secure co-parent invite continuation,
  community threads and auth-safe notification routing. Signed iOS and Android
  lifecycle QA remains. Universal Links and Android App Links are not
  requirements of the original brief. Once verified, do not reopen Deep Links
  during refinements unless an actual bug is found.

## TestFlight Change Requests — Developer Brief v3 (August 2026)

Source: `DadHealth_Developer_Brief_v3.docx` (Jamie Smith). The brief is not in
the repo; it lives outside the project directory.

**Change 04 — Pro Conversion Strategy: complete.** Checklist items 9, 10, 11,
17, 18 and 19 are implemented and covered by `tests/proConversion.test.mjs`.
See **Pro Conversion** above for the rules that resulted.

Remaining brief changes, not started:

- Change 01 — navigation rename and reorder (Today / Mind / Score / Body / Bond
  / Community). Jamie asked to be advised on 5-tab vs 6-tab before implementing.
- Change 02 — rebuild Home around Today (checklist 2–6).
- Change 03 — Mind screen action-first opening, 5- and 10-minute options
  (checklist 7, 8).
- Change 05 — Community empty state and pre-seeded circle prompts.
- Change 06 — Dad Days quick filter chips and affiliate card.
- Change 07 — Cook Together Bond logging confirmation and badge.
- Change 08 — copy fixes, including the "1 moves" bug.

### Pro reconciliation decisions

Two brief lines conflicted with the shipped architecture. Both were resolved in
favour of the brief, and both are worth confirming with Jamie:

- **Full TDEE.** The brief lists "Full TDEE" as Pro; the calculator was entirely
  free. Free members keep the core answer (BMR, TDEE, BMI and the maintenance
  target); the fat-loss, aggressive-cut and lean-bulk targets plus the insights
  are Pro behind a visible preview. This narrows what existing free users see.
- **Monthly report.** The brief's Reports row gives free members nothing, so the
  monthly report grid and its share/PDF action are now Pro. The grid still
  renders as the locked preview.

### Open items for Jamie

- **"Meal planner basics" (free).** The brief puts meal planner basics in the
  free column, but plan generation is gated server-side on the web
  `/api/generate-meal-plan` route and there is no non-AI meal content in the
  product. Free members currently get the planner screen, the filters and a
  locked preview. Making basics genuinely free needs either a free tier on that
  API or a set of static starter plans — a decision and web-side work.
- **"Training plans" (Body, Pro)** and **"Family activity plans" (Bond, Pro)**
  do not exist as features. Nothing was invented for them.

## Screen Migration Milestone

Completed.

All standalone native product screens, focused sub-screens, account flows and dashboard subsections have been migrated and reviewed.

The codebase security and organization audit is also complete:

- Native tab screens live directly in `screens/`.
- Stack, detail, authentication, onboarding and settings screens live in `screens/subscreens/`.
- Known npm dependency vulnerabilities were remediated without forcing an Expo major upgrade.
- Biometric login stores a revocable per-device credential, never a password or copied Supabase refresh token.
- Google OAuth uses PKCE.
- Confirmed dead screen and component code was removed.

## Completed

### Public Home

Completed.

Uses:

- Web functionality
- Mockup layout
- Native onboarding flow
- Native score preview
- Native pillar presentation

### Logged-in Dashboard

Completed.

Reviewed and approved component by component.

Includes:

- Header
- Dad Score
- Daily Check-in
- Today's Plan
- Mood This Week
- Smart Reminders
- Weekly Challenge
- Upgrade Pro
- Navigation
- Loading States
- Empty States
- Error States

Both completed screens follow:

- Web = functionality
- Mockups = design

### Fitness

Completed.

Reviewed and approved component by component, including focused native flows for active workouts, AI workouts, meal planning and TDEE.

### Mind

Completed.

Reviewed and approved component by component, including:

- Header
- Mood This Week
- Breathing session
- Private journal
- Therapist directory
- Crisis support
- Statistics and screen states

### Bond

Completed.

Reviewed and approved component by component, including Dad Days, milestones, Cook Together, conversation starters and the shared custody calendar.

### Squad

Completed.

Reviewed and approved component by component, including circles, community posts, post threads, recent-post navigation and live sessions.

### Progress

Completed.

Reviewed and approved component by component, including Dad Score reporting, saved reports, sleep quality and mood correlation.

### Account and Settings

Completed.

Includes Profile, profile photos, Push Notifications, Privacy & Security, Terms & Privacy and Sign Out.

---

# Deferred Product Improvements

These are intentionally outside the migration scope.

- Today's Plan onboarding mismatch
- Mood Week weekday labels
- TDEE calculation history and body-value logging
- Non-contact Days card and its wording versus reduced non-custody Bond Score weighting
- Progress badge catalogue fallback is labelled as earned when no earned badges exist

These items may be considered during Final Polish, but only one at a time after review and explicit approval.

---
# Current Milestone

## Milestone 3 — Native Integrations

The screen migration is complete.

Milestone 3 focuses on making DadHealth a true native mobile application while preserving the existing product behaviour.

Every integration must still follow the same review workflow.

Review one integration at a time.

Explain:

- What the web currently does.
- What native capability is being added.
- Required libraries.
- Required Supabase changes.
- Native permissions.
- Offline behaviour.
- Edge cases.

Recommend:

- Keep
- Modify
- Remove
- Replace

Wait for explicit approval.

Implement only the approved integration.

Return to review mode before continuing.

---

## Remaining Order

1. Deep Links signed iOS / Android lifecycle QA
2. Android Health Connect and full iOS / Android production QA

Native subscription external Apple and Google configuration proceeds separately
as store access and configuration become available.

After the remaining M3 implementation is complete:

- Handle Jamie's small refinements as a separate pass.
- Prepare major customer-journey changes as a separate document and batch for
  Jamie's approval.

---

## Milestone Principles

Native integrations must enhance the existing product.

Do not redesign existing features.

Do not change business logic unless explicitly approved.

Preserve:

- Existing Supabase architecture
- Existing API routes
- Existing permissions
- Existing calculations

If an integration requires database schema changes, API changes or new tables:

Stop.

Explain the required changes.

Wait for approval before implementation.

Deployment, production configuration and App Store submission remain separate tasks and are not part of implementation unless explicitly requested.

# Navigation

Keep the approved native navigation structure.

Bottom Tabs

- Body (`Fit` route)
- Mind
- Today (`Home` route; raised lime tab)
- Bond
- Community (`Squad` route)

Keep the internal `Home`, `Fit` and `Squad` route names for notification and
navigation compatibility. Progress remains a standalone dashboard/stack
destination and is not part of the bottom navigation.

Secondary screens remain inside the Account/Profile menu.

Do not introduce new navigation patterns unless explicitly requested.

---

# Documentation

This file is not a changelog.

Keep it focused on:

- Project rules
- Workflow
- Current completed work
- Remaining work
- Deferred product decisions

Remove historical implementation notes once they are no longer relevant.
