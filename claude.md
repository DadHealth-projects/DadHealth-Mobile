# CLAUDE.md — DadHealth Mobile

## Project

DadHealth is a React Native / Expo app for iOS and Android.

Mobile repo:
`E:\client-projects\dadhealth-mobile`

Shared web/backend repo:
`E:\client-projects\dadHealth`

The mobile app shares Supabase authentication, business data, backend services and canonical product rules with the web application.

The mobile client owns native presentation and native platform capabilities.

Do not duplicate privileged backend logic or independently calculate canonical product values in mobile code.

---

# CURRENT PRODUCT STATUS

## M4 — Phase 3
**COMPLETE / APPROVED / PAID**

M4 is the native-integration baseline.

Do not reopen M4 work unless an explicitly approved task requires a regression fix or new change.

## Dad Health Journey & Personalisation Formation
**IMPLEMENTATION COMPLETE**

The Next Milestone Brief, Addendum A and approved Changes 01–08 have been implemented.

Addendum A is the final source of truth where it supersedes the original Today/Score requirements.

### FROZEN SCOPE

Treat the following as completed product scope:

- Today + Score merge
- Mind rebuild
- Change 03 — Score trends / weakest pillar
- Change 04 — Pro conversion
- Change 05 — Free vs Pro
- Change 06 — Body pillar presentation
- Change 07 — Manual activity logging / scoring
- Change 08 — Bond / Present Dad / Community
- completed navigation architecture

Do not reopen, redesign, restore deprecated behavior, or make opportunistic changes to these areas unless the user explicitly approves a new task or a verified regression requires correction.

Historical briefs and TestFlight feedback are context only and must not override later approved requirements.

---

# SOURCE OF TRUTH

When requirements differ, use the most recent approved product decision.

Priority:

1. Latest approved addendum/amendment or explicit Jamie decision
2. Latest approved milestone requirement not superseded by #1
3. Canonical backend/product behavior
4. Current completed mobile implementation
5. Approved UI/mockups

Older briefs, old TestFlight feedback and superseded requirements must not be treated as active work.

If current approved sources genuinely conflict, report the conflict and ask before changing behavior.

---

# NAVIGATION — FROZEN

Current navigation:

**Today → Mind → Body → + LOG → Bond → Community**

There are five navigation tabs:

- Today
- Mind
- Body
- Bond
- Community

`+ LOG` is a raised quick-action control, not a navigation tab.

It opens:

- Log workout
- Log Bond time
- Log Mind activity

There is no Score tab.

Score lives inside Today. Tapping the Dad Health Score card opens the Score Detail Sheet.

Legacy Score/Progress routes may redirect to Today + Score Detail for compatibility.

Never restore the old Score/Progress navigation without explicit approval.

---

# CANONICAL SCORE

Dad Health Score contains:

- Mind
- Body
- Bond

One canonical backend source owns:

- total score
- pillar scores
- week-on-week trends
- weakest pillar
- recommended action

Mobile screens must consume these values rather than independently calculating them.

Do not hardcode or fabricate scores, trends, weakest-pillar results or recommendations.

## Trends

Week comparison is Monday–Sunday.

Trend values are score-point differences, not relative percentages.

Example:

`BODY 37% ↓ 3 pts`

If the canonical previous-week comparison is unavailable, display the neutral state without inventing a change value.

### Change 07 transition

Change 07 introduced the new manual-activity scoring model.

The first effective Change 07 week intentionally has no comparable previous-week trend because the previous week used the old scoring model.

Do not “fix” this by fabricating or restoring a cross-model trend.

Once two comparable weeks exist under the new model, canonical numeric point trends can resume where data exists.

---

# TODAY — COMPLETE / FROZEN

Today is the daily hub.

Approved hierarchy:

1. Greeting
2. Dad Health Score
3. contextual Pro tease
4. Daily check-in
5. One Focus
6. Streak
7. Weekly card when applicable
8. Supporting tools
9. This week's challenge

One Focus consumes the canonical recommended action.

After a completed check-in, it must not recommend completing the same check-in again.

Mood belongs on Mind.

Historical Score information belongs in Score Detail or the relevant pillar.

Do not show empty Smart Reminder rows.

---

# SCORE DETAIL — COMPLETE / FROZEN

Score Detail replaces the old Score tab.

It contains the approved:

- score/pillars
- explanation of pillar inputs
- contextual Pro insight
- history
- monthly report preview
- badges
- Share Report

There is one Share Report action.

Share Report is available to Free and Pro users.

Historical/deeper Pro outputs retain their approved gating.

All values consume the canonical Score source.

---

# MIND — COMPLETE / FROZEN

Mind is action-first.

Current approved experience includes:

- 5-minute Mind Reset: 1 minute of 4-4-4 breathing, then 4 minutes of guided Reset
- 10-minute Guided Reflection
- Journal
- therapist directory
- Community entry
- Mood This Week
- Sleep Quality This Week
- Pro Mood Correlation / Pattern insight
- Pro Mind Plan placeholder

Mood uses the approved 1–5 model.

Reset/Reflection copy remains provisional until Jamie supplies replacement copy.

The Pro Mind Plan is intentionally a lightweight placeholder. Do not invent a plan-generation engine or backend recommendations.

Mind has one 44pt “Need urgent help?” link near the top. It shows Samaritans details before a separate call action.

Do not add a global floating Crisis Support button or duplicate Mind entry point.

---

# BODY — COMPLETE / FROZEN

Body owns:

- workouts
- AI Workout
- Meal Planner
- calorie/TDEE tools
- Workout Library
- wearable activity
- manual workout logging

Basic approved Body functionality remains Free according to the completed entitlement implementation.

Wearable activity belongs below the primary Body experience.

Do not show empty wearable metric rows when no data/device is available.

Sync status belongs in Settings.

Do not restore old Body behavior from historical feedback unless explicitly approved.

---

# BOND — COMPLETE / FROZEN

The active Bond product contains:

- Present Dad Mode
- Dad Days
- Cook Together
- Manual Bond logging

Do not restore:

- Dad Dates
- Co-parenting Calendar
- Milestone Tracker
- Conversation Starters
- other deprecated Bond tools

Present Dad sessions are server-authoritative.

Under 5 minutes:
- retained
- no Bond Score credit

5+ minutes:
- eligible for canonical Bond scoring

iOS Focus/Do Not Disturb remains user-controlled.

Never claim the app automatically enabled system Focus.

---

# COMMUNITY — COMPLETE / FROZEN

Community is available to Free and Pro users.

Current Circles:

- New Dad Crew
- Single Dads
- Dad Strength
- Every Kind of Dad

Do not restore Teen Dad Club.

Jamie owns final production Community seed content.

Do not invent launch posts/prompts.

---

# MANUAL ACTIVITY LOGGING — COMPLETE / FROZEN

Manual logging exists for:

- Body
- Mind
- Bond

Backdating is supported up to 7 days.

Use the existing `activity_logs` backend contract.

Do not create a competing mobile-only activity model.

Manual logs contribute to canonical scoring according to the active, versioned backend model.

Important scoring principles:

- highest-scoring manual log per pillar/day contributes
- all valid logs remain stored
- Mind uses 60% manual activities plus 40% weekly check-in participation, earned proportionally across seven days
- Body and Bond use 60% manual activities, 10% relevant check-in participation, and 30% existing eligible non-manual contributions
- check-in points depend on participation, never answer positivity; low answers do not reduce scores
- low answers never reduce scores; keep wellbeing alerts, recommendations and support guidance separate
- Mood and Stress remain available for history and wellbeing insights but do not change new-model Mind points
- closed weeks retain the formula version effective for that Monday–Sunday week
- missing Mind check-in days earn no participation credit
- minimum-duration and activity weighting rules remain backend-owned
- Mini Partners contributes to Body and Bond according to canonical rules

Do not reproduce these calculations independently in mobile UI.

---

# FREE / PRO — FROZEN

Do not invent new paywalls, quotas or entitlement rules.

Free includes the approved core product experience, including:

- current Dad Health Score
- current canonical pillar scores/trends where available
- daily check-in
- basic Mind actions
- Mood This Week
- Sleep This Week
- basic workouts
- manual activity logging
- Community
- limited Dad Days
- Share Report
- Mind Crisis Support link

Pro owns the approved deeper/personalised outputs, including:

- deeper/historical Score insights
- extended Score history
- monthly report
- Mood Correlation / Pattern insight
- Mind Plan placeholder
- approved AI Workout personalisation
- weekly report
- streak protection
- unlimited Dad Days

Preserve the completed Change 05 entitlement implementation.

---

# WEEKLY REPORT / STREAK

Week boundaries are Monday–Sunday.

Weekly report release is Sunday after 08:00 according to the existing implementation.

Free receives the approved teaser/basic information.

Pro receives the approved deeper report.

Streak state and freeze usage are server-authoritative.

Pro receives the implemented one-freeze-per-week behavior.

Do not create client-side competing streak calculations.

---

# JAMIE-OWNED OUTSTANDING CONTENT

These do not reopen the completed engineering milestone:

1. Cook Together first-completion badge definition/content
2. approved Community production prompts / seed content
3. any final replacement copy Jamie supplies for provisional guided Mind content

Do not invent these requirements.

---

# NATIVE / BACKEND BASELINE

Preserve the existing approved implementations for:

- Supabase Auth
- Apple Sign In
- Google OAuth / PKCE
- biometrics
- Apple HealthKit
- Google Health Connect
- native subscriptions
- OneSignal
- deep links
- offline support

Server/backend responsibilities stay in the shared backend.

Never expose:

- service-role credentials
- passwords
- raw tokens
- internal provider/database errors

Use targeted Supabase migrations.

Never apply the entire schema to production as a substitute for a migration.

Avoid new dependencies unless genuinely necessary.

---

# SCOPE CONTROL — MANDATORY

For every requested change:

1. Inspect the relevant implementation.
2. Review the current requirement/source of truth.
3. Report what you found.
4. Identify the exact files that would need modification.
5. Explain the smallest proposed change.
6. STOP and ask for approval.
7. Edit only after explicit approval.
8. Test only the approved change and relevant regressions.
9. Report results.

**Review does not grant permission to edit.**

Never modify unrelated files, features, UI, backend behavior, scoring, navigation, entitlements or completed milestone work simply because you notice something that could be improved.

Never perform opportunistic cleanup/refactoring outside approved scope.

If another issue is discovered during implementation, report it separately and leave it unchanged unless approval is given.

When the user says **review only**, absolutely no repository files may be created, edited, deleted, reformatted or moved.

---

# DOCUMENTATION

This file records current product truth and permanent development constraints.

Do not accumulate completed implementation diaries, temporary debugging notes, commit history or obsolete requirements here.

When a later approved decision supersedes an existing rule:

- replace the obsolete rule;
- do not keep both versions;
- keep this document concise.

Completed/frozen milestone areas remain frozen until an explicitly approved task changes them.

# Phase 4 Milestone 2 Status

## Status
IN PROGRESS. Steps 1-5 implementation is reported complete and deployed. The five production Pro/access and saved-content checks, and device testing, are user-reported history; they were not independently repeated in this review.

## Implemented
- Shared Pro entitlements, upgrade moments/navigation, expiry and saved-content access; manual grants; Stripe atomic profile synchronization. Stripe synchronization migration application is user-reported.
- Google RTDN ordering uses a server verification-start timestamp. Source-level regression coverage exists; production runtime processing remains unverified.
- Check-in, Mind Quick Fixes and Journal modes; weekly Free Body workout; Cook Together weekly Free recipe; 60/40 Mind and 60/10/30 Body/Bond scoring implementation and SQL regression suite.
- Mind Plan remains locked-preview-only. Do not build its plan engine.

## Verification outstanding and confirmed gaps
- Production migration ledger for `20261016120000_pillar_score_60_40_10_30.sql` was not accessible. Do not mark it applied without an operator check. The migration and SQL tests exist locally.
- Google RTDN delivery/processing in production is unverified. EAS/App Store/Google Play product values and installed native-build configuration could not be inspected here. Expo Go price-unavailable behavior is not evidence of a production pricing defect.
- `WeeklyReportCard` shows a locked copy/CTA to Free users but does not include their current score in that teaser; the current score is shown separately. This is an implementation gap to resolve within approved scope.
- Trial labels currently differ: the shared badge says `Trial`; Profile membership says `Pro Trial`. The brief leaves exact badge wording open; Jamie must choose one if consistency is required.
- Subscription management opens the relevant provider/portal. No separate cancellation-reason step was found. Confirm whether a reason-only flow is still wanted; the previously rejected 50% offer is excluded.

## Jamie-owned content and decisions
- Approve Journal prompt copy; Jamie supplies Community seed prompts/posts (5-10 per circle and weekly official prompts); define the first Cook Together completion badge.
- Confirm whether a cancellation-reason step without an offer is wanted, and choose consistent Trial badge wording.

## Deferred
Full Sunday report, automatic streak freeze, full paywall redesign, final performance audit, and Mind Plan generation are deferred. Later confirmed scope supersedes any older brief text suggesting these ship in this milestone. Do not implement them without new approval.

Completed work remains protected. Do not mark user-reported production checks as independently verified. Preserve all permanent rules above and require explicit approval before reopening completed work.
