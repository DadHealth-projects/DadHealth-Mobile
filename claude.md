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

- 2-minute 4-4-4 breathing
- 5-minute Reset
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

Crisis Support is a single app-wide action available regardless of login or subscription.

Do not restore a duplicate large Crisis card inside Mind.

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

Manual logs contribute to canonical scoring according to the completed Change 07 backend rules.

Important scoring principles:

- highest-scoring manual log per pillar/day contributes
- all valid logs remain stored
- manual activity contributes up to 70 points
- existing inputs provide the remaining 30-point component
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
- global Crisis Support

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