CLAUDE.md — DadHealth Mobile

Governing Rule

Preserve product truth from the web/backend. Present it as a native mobile product.

DadHealth mobile is not a scaled-down website. The web/backend defines product behavior and data contracts; the approved native design defines mobile presentation.

Project Rules

Error Placement

The top toast (`GlobalConnectivityToast`) is connectivity only: offline, back
online, and actions that need a connection.

Every other error — a failed load, a failed save, a feature error — renders in
the screen at the bottom. Screens report through `<ScreenErrorNotice message=…>`
and one `ScreenErrorBanner` renders it above the tab bar. Never put a feature
error in the top bar, and never paint a red banner into a screen.

Errors clear themselves after five seconds, like the connectivity toast. Nothing
stays on screen until the dad navigates away.

Production Error Copy

Every user-facing error must name the affected feature/action and give a useful next step.

Never expose internal provider names, database/API/schema details, tokens, environment variables, stack traces or raw caught errors.

Do not ship temporary diagnostics or implementation-state labels.

Screen-level load errors must name the current screen/content.

Avoid vague placeholder copy such as “Something went wrong”.

Source of Truth

Web/backend = WHAT

Use the web/backend for:

features

business logic

calculations

Supabase contracts

entitlements

quotas

canonical product behavior

Native app/mockups = HOW

Use native design for:

layout

hierarchy

spacing

typography

interactions

navigation presentation

Never copy the web layout directly to mobile.

Database / Backend

Do not change schema, RLS, API contracts or server calculations without explicit approval.

Use targeted migrations only.

Never apply full schema.sql as a production migration.

Prefer server-owned canonical calculations over duplicated client formulas.

Do not add synthetic/fake rows merely to make UI logic easier.

Dependencies

Do not add a new third-party package without explicit approval.

Prefer existing project/platform capabilities.

Do not broad-upgrade Expo/React Native during a feature refinement.

Workflow

For every new refinement:

Read the relevant web/backend behavior.

Read the current mobile implementation.

Return Keep / Modify / Remove / Add.

Identify product/data gaps.

Separate:

UI-only changes

mobile logic changes

backend/schema changes

Wait for explicit approval.

Implement only the approved unit.

Run focused tests + typecheck.

Explain exactly what changed.

Return to review mode.

Never continue automatically into the next unit.

If behavior is undefined: stop and ask. Never invent product logic.

Current Product State

Screen Migration

Completed.

Primary native screens and focused sub-screens are already migrated. Current work is formation/refinement, not migration.

Do not reopen completed screens broadly. Make focused product changes only.

Milestone 3 — Native Integrations

Implemented:

M3.1 Push Notifications

M3.2 Apple HealthKit

M3.3 Google Health Connect

M3.4 Native Subscriptions

M3.5 Offline Mode

M3.6 Deep Links

Remaining verification/configuration:

signed iOS/Android deep-link lifecycle QA

final Android Health Connect production-device QA

full production QA

external Apple/Google store configuration where still required

Do not reopen completed M3 integrations during formation unless an actual bug is found.

Current Navigation

Visible bottom tabs:

Today

Mind

Score

Body

Bond

Community

Rules:

Today remains the daily hub.

Score is the raised lime CTA.

Existing Progress content is reused for Score.

Preserve existing internal route names where required for compatibility, including Home, Fit and Squad.

Do not casually rename internal routes used by push/deep links/navigation.

The old 5-tab structure is obsolete.

Today Formation — Completed

The Today refinement is complete.

Current hierarchy:

Greeting

Dad Health Score

Pro insight/preview when applicable

Today’s check-in

Your one focus

Streak

Supporting tools

Existing lower-priority content

Current approved score behavior:

check-in includes mood, stress and sleep

check-in visibly connects to Mind score

score trends compare current rolling 7 days with previous non-overlapping 7 days

weakest pillar is highlighted

completed Present Dad sessions contribute to Bond

mobile consumes server-owned scores/trends

no fake/hardcoded user score or trend values

One-focus mapping:

incomplete check-in first

Mind → Breathing

Body → Suggested workout

Bond → Present Dad Mode

ties follow existing approved priority order

Do not rewrite this logic during Mind/Pro work.

Mind Formation — Completed

Approved direction

The screen should support a dad who may be opening it in a difficult moment.

Current ordering decision:

Keep the “1 in 8” mental-health statistic near the top as brief context.

Crisis Support is the first actionable item immediately after it.

Breathing/reset actions follow.

Journal remains prominent.

Therapist support remains.

Community remains available.

Mood information/trends can sit lower.

Statistics decision

The large paired 1 in 8 / 4 in 10 statistic-card block is removed. Settled — do not reopen.

Do not replace removed statistics with filler cards.

The screen finishes on support/actions/user-relevant information, not generic statistics.

The seven-day mood trend stays with Pro, shown as a locked preview of the chart
(empty tracks and real weekday labels only, never a stand-in mood value).

Crisis Support

Must remain always visible in the Mind experience.

Must remain accessible without login.

Never hide crisis support behind Pro or an authenticated-only flow.

Do not change crisis destinations/copy without review.

Product gaps

Do not invent:

a new 5-minute Reset Exercise

a new 10-minute Guided Reflection

a personalised Mind plan

new AI behavior

new mood-trend data

If these do not already exist in the current code/backend, flag them for product review.

Pro Conversion (Change 04) — Completed

Jamie’s principle:

Do not sell Pro aggressively. Let free value create curiosity for personalisation.

Implemented — the 7 Pro moments and the paywall:

Moment 1 after the score, using real server point deltas. Never percentages.

Moment 2 after the check-in, following the free recommendation. Moments 1 and 2
are mutually exclusive so Today never carries two upgrade asks in one scroll.

Moment 3 AI workout value copy. Filters stay usable before the lock.

Moments 4 and 7 on Dad Days: existing filters stay free, the counter reads as
used, and Pro claims unlimited searches only.

Moment 5 weekly report on Progress, built on `dad_score_view` week-change
points. No narrative, no percentages, no generated recommendation.

Moment 6 progress tease, built on the real monthly workout count.

Paywall: “Make Dad Health personal”, annual first, store-supplied prices only,
real 7-day trial detection, three concrete benefits, no first-open paywall.

Approved Free vs Pro split — settled, do not change without a new decision:

Free — therapist and counsellor directory; milestone logging; the basic Dad
Health Score including the Mind, Body and Bond pillar values; the workout
library; the TDEE calculator numbers (BMR, TDEE, BMI); reading a meal plan
already saved to the account; the first three AI meal plans, then Pro; journal;
breathing; Community; crisis support; three Dad Days searches a month with all
existing search filters.

Both allowances are enforced server-side, not just in the client: Dad Days by
`api/dad_days_searches`, AI meal plans by `FREE_AI_MEAL_PLANS` in
`api/generate-meal-plan`, counted from the member's own `ai_generated` rows.

Pro — weekly score trends, including the trend arrows beside the pillar values;
pillar insights and recommendations; every seven-day trend surface, shown to free
members as a locked preview: the mood week on Today and Mind, Body this week on
Body, sleep quality and mood correlation on Progress; the full TDEE calorie
targets and insights; AI workouts; AI meal plans; milestone photos; the weekly
Dad Health report and the monthly summary; unlimited Dad Days.

A pillar value is free. A pillar's movement over time is Pro. Any chart covering
a range of days is Pro, wherever it appears. The one deliberate exception is Pro
moment 1, which reveals a single positive trend as the upgrade tease.

Where the brief says “basic”, the rule is: the existing manual experience stays
free and the AI or personalised experience is Pro. No new tier was invented.

The weekly Dad Health report dispatches Sunday 08:00 local
(`dadHealth` `api/notifications/dispatch`). The window still ends on yesterday,
so it stays a complete seven days. The weekly challenge keeps its Monday
cadence.

Remaining known gaps — do not act without approval:

Undefined product logic: mood/stress recommendation mapping, Dad Days “time
available” and “what they enjoy” inputs, AI workout mood input, weekly report
narrative copy.

Entitlement reads are fragmented across several screens while the paywall reads
the native-subscription API. Consolidate before adding further gates.

Rules:

no fake/hardcoded scores, trends or workout counts

no Upgrade-to-Pro spam on every screen

no paywall on first open

preview value before locking where possible

Community remains free

do not change native subscription purchase architecture

further entitlement changes require separate review

Native digital subscriptions remain:

iOS → StoreKit/App Store

Android → Google Play Billing

Web Stripe remains separate.

Architecture Guardrails

Read ARCHITECTURE.md before architecture-sensitive work.

Key rules:

Supabase is shared by web/mobile.

privileged operations belong server-side.

mobile must not contain service-role secrets.

score calculation remains server-owned.

offline data is user-scoped.

sign-out must not leak another user’s cache/queue.

push routing/deep-link route compatibility must be preserved.

use targeted backend changes only.

Deferred / Separate Product Work

Keep separate from small formation unless specifically approved:

full notification/activity center

larger customer-journey restructuring

undefined personalised recommendation systems

new AI product flows

new backend content-generation systems

broader entitlement redesigns

Document product gaps rather than silently implementing them.

Documentation Rule

CLAUDE.md is current operating context, not a changelog.

Keep it focused on:

rules

architecture guardrails

current product state

current active unit

important approved decisions

remaining verification

Remove stale historical implementation notes when they stop affecting future work.