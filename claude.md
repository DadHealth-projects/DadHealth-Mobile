# CLAUDE.md — DadHealth Mobile

## Project

DadHealth is a React Native / Expo application for iOS and Android.

The mobile app shares the DadHealth Supabase backend, authentication, business data and product rules with the web application.

The mobile client is responsible for native presentation and native platform capabilities. It must not duplicate privileged backend logic or independently implement canonical product calculations.

Repository:

`E:\client-projects\dadhealth-mobile`

---

# Current Status

## M4 — Phase 3 Native Integration & Refinement Pass

**Status: COMPLETED, APPROVED AND PAID**

M4 is the latest completed milestone and the current implementation baseline.

Do not reopen or rebuild M4 work unless a new task explicitly requires a regression fix or change.

## Active Milestone

**Next Milestone Brief — Dad Health Journey & Personalisation Formation**

This is the current active product milestone.

The latest amendment is:

**Brief Addendum A — Merge Score into Today**

Addendum A overrides the relevant navigation, Score and Today decisions from the main milestone brief.

Do not use older milestone briefs, TestFlight feedback or historical Jamie decisions as the current product specification when they conflict with these documents.

## Today + Score Merge Status

**Status: Implemented against Addendum A.** Addendum A is the source of truth for the Today hierarchy and Score location. The Score tab is removed; legacy Score/Progress destinations remain compatibility redirects to Today with the Score Detail Sheet opened.

Today stays compact and action-first: the Pro tease is inside the Score card, Mood This Week stays on Mind, Smart Reminders appear only when present, and the weekly card appears only on its configured Sunday release. Historical score history and report details belong in the Score Detail Sheet.

The Today card and Score Detail Sheet consume canonical score values, trends, weakest pillar and recommended action. Preserve current Free/Pro trend gating. Render a trend only when the canonical comparison value exists; never invent a trend for missing history. One Focus uses the canonical recommended action rather than recalculating the weakest pillar on the client.

---

# Source-of-Truth Hierarchy

When deciding what to build, use this order:

1. **Latest approved milestone brief**
2. **Latest approved addendum/amendment**
3. **Existing web/backend product behavior**
4. **Current mobile implementation**
5. **Approved native UI/mockups**

Older briefs and feedback documents are historical context only.

If two current sources genuinely conflict and the conflict cannot be resolved from the documents, stop and ask rather than guessing.

---

# Product Principle

The active milestone is centered around one question:

> Does this help the dad understand how he is doing, decide what matters today, and take one simple action?

The product should demonstrate the value of Dad Health through the free experience rather than aggressively selling Pro.

Do not introduce unnecessary UI, filler content, artificial recommendations or unrelated redesigns.

---
# Navigation

## Status: Complete

The completed mobile navigation has **five tabs plus a separate raised + LOG action**:

**Today → Mind → Body → + LOG → Bond → Community**

The five navigation tabs are:

* Today
* Mind
* Body
* Bond
* Community

**+ LOG is a quick-action control, not a navigation tab.**

The **+ LOG** action is a raised centre button and opens:

* Log workout
* Log Bond time
* Log Mind activity

The five tab routes remain Today, Mind, Body, Bond and Community. The + LOG button is not a tab and preserves its workout, Bond and Mind logging actions.

## Score

There is **no Score tab**.

Score is part of Today.

Tapping the Dad Health Score card opens the **Score Detail Sheet**.

Legacy Score navigation must not be restored.

If an existing deep link, notification or internal route targets the old Score destination, it should resolve to Today with the Score Detail Sheet expanded where technically supported.

## Navigation Rules

* Today is the first tab.
* Mind is the second tab.
* Body is the third tab.
* + LOG sits between Body and Bond and is not a tab.
* Bond follows Body.
* Community is the final tab.
* + LOG remains the raised centre quick-action button.
* Score is accessed through Today and must not become a bottom-navigation tab.
* Do not describe + LOG as a navigation tab.
* Do not restore the previous six-tab Score navigation.

---

# Dad Health Score

Dad Health Score contains:

* Mind
* Body
* Bond

All Score values must come from one canonical source.

This includes:

* total Score
* pillar Scores
* week-on-week trends
* weakest pillar
* recommended action

Do not calculate the Score independently inside individual mobile screens.

Do not hardcode fake Score or trend values.

Score recalculation must follow the current backend/product implementation and active milestone rules.

## Trends

Use the active milestone's agreed comparison window.

Display trends in the approved format:

`MIND 56% ↓ 27%`

The Score appears first, followed by the trend.

When the canonical trend is null because there is no previous-week data, show no trend.

## Weakest Pillar

The weakest pillar is the lowest of Mind, Body and Bond.

Recommendations must use the mapping defined in the active milestone.

Do not create competing recommendation logic inside Today, Mind, Body or Bond.

---

# Today

Today is the primary daily hub.

The active hierarchy is:

1. Greeting
2. Dad Health Score card
3. Pro tease / upgrade moment
4. Daily check-in
5. Your One Focus
6. Streak
7. Weekly card on report day
8. Supporting tools
9. This week's challenge

## Dad Health Score Card

The card contains:

* Score ring
* Mind
* Body
* Bond
* trend values
* weakest-pillar indication

Tapping the card opens the Score Detail Sheet.

Keep the card compact. Preserve current entitlement gating for trends, use canonical trend values, and show each trend after its pillar score only when that value exists.

## Daily Check-in

The check-in contains the three approved daily questions.

After submission, the relevant Mind value should update using the canonical Score source.

If the check-in is already complete, **Your One Focus must not tell the user to complete the check-in again**.

## Your One Focus

The action is based on the weakest pillar and the current day's state.

Use only the recommendation/action mapping defined in the active milestone.

## Today Content Removed / Moved

Mood information belongs on Mind.

Historical Score information belongs in the Score Detail Sheet or the relevant pillar.

Empty Smart Reminder content should not appear as an empty row.

---

# Score Detail Sheet

The Score Detail Sheet replaces the old Score tab.

It is opened from the Today Score card.

Order:

1. Score + pillars
2. What feeds each pillar
3. Pro improvement/insight tease
4. Score trend history
5. Monthly report card preview
6. Badges
7. Share report

There should be one Share Report action in this experience.

The sheet is full-height. The Pro insight tease is shown to Free users only. Share Report is available to Free and Pro users; score history and the monthly report retain their specified Pro previews/gating.

Score detail, trends and badges must use the same Score source as Today.

---

# Mind

## Change 02 + Addendum A A6 Status: COMPLETE

Mind keeps an action-first entry with 4-4-4 breathing, the provisional five-minute reset, the provisional guided reflection, Journal, therapist directory and Community. The two guided sessions use five day-specific reflection prompts; their copy is provisional and must be replaced only with client-approved copy. Crisis help is a single app-wide root action using the existing configured contact, with no login or Pro gate.

Mind Facts and Sleep Quality This Week follow the feeling introduction. Mood This Week remains Free and uses the current 1–5 mood scale. Mood Correlation / Pattern Spotted remains Pro with a locked Free preview. Weekly mood, sleep and correlation data use Monday–Sunday boundaries and normalize legacy mood values.

Free users see the existing Pro upgrade entry for a personalised Mind plan. Pro users see an active entry to a lightweight placeholder sheet. The sheet explains that a future plan will use mood, Dad Health Score and history; no plan generation, recommendations or backend service is implemented until client requirements are supplied.

Mind is **action-first**.

The user should be able to take a useful action immediately.

Core actions defined by the active milestone include:

* **2 MINUTES — Breathing reset (4-4-4)**
* **5 MINUTES — Reset exercise**
* **10 MINUTES — Guided reflection**
* **TALK TO SOMEONE — Therapist directory**
* **I JUST NEED TO TALK — Community**
* **PRO — personalised plan**

Crisis support is app-wide and remains visible and accessible without login; Mind must not add a duplicate large crisis card.

Mind owns:

* Mood This Week
* Sleep Quality This Week
* Mood Correlation / Pattern Spotted
* Journal
* Mood Trends

Mood uses the current approved 1–5 model.

The UI should use the approved mood labels rather than displaying the mood as a fractional score.

---

# Body

Body owns physical activity, workouts, nutrition tools and wearable activity.

Current feature areas include:

* AI Workout
* Meal Planner
* TDEE / calorie calculator
* Workout Library
* wearable activity
* manual workout logging

Follow the current active brief for feature availability and Free/Pro entitlements.

Do not bring old Body-specific decisions back simply because they exist in historical TestFlight feedback.

## Wearables

Wearable information belongs below the primary Body feature cards.

When no wearable is connected, show the approved Connect Apple Health state.

Do not display empty Steps/Active Minutes rows.

When connected, supported data can include:

* Steps
* Active Minutes

Sync status belongs in Settings.

---

# Bond

Bond is one of the three Score pillars.

Current active features include:

* Present Dad Mode
* Dad Days
* Cook Together
* Manual Bond logging

Features explicitly removed by the current milestone must not be restored without a new approved requirement.

Manual Bond activity contributes to the Bond Score according to the canonical backend rules.

---

# Community

The current Community direction uses:

**Every Kind of Dad**

Community is available to Free and Pro users.

The community structure and initial seeded content are governed by the active product brief and Jamie-provided content.

Do not invent production community content when Jamie is responsible for supplying it.

---

# Manual Activity Logging

Manual logging is part of the active milestone.

## Body

Support:

* activity type
* duration
* intensity
* date
* notes

Backdating is supported up to seven days.

## Bond

Support the approved Bond activity types, including:

* routine
* play
* active
* out & about
* remote
* other

Support contact-day state where defined by the product.

## Mind

Support:

* professional support
* mindfulness
* social connection
* nature/recovery
* other

Use the backend activity-log contract rather than creating a separate mobile-only data model.

New logs must trigger the approved Score recalculation behavior.

---

# Free and Pro

Use the active milestone's entitlement rules.

Core Free experience includes:

* basic Dad Health Score
* daily check-in
* Mind breathing and Journal, with global crisis support available app-wide
* basic Body workouts
* manual activity logging
* limited Dad Days
* Community

Pro adds defined personalisation and historical insight such as:

* weekly Score trends
* pillar insights
* personalised recommendations
* mood history/pattern insights
* personalised Mind plan
* personalised AI Workout
* deeper progress/trend history
* expanded Dad Days
* personalised Bond insights
* weekly report
* streak protection
* monthly report card

The active milestone is authoritative for exact limits and entitlement behavior.

Do not invent new paywalls or quotas.

---

# Pro Conversion

Pro should appear at contextual moments where the user has already experienced value.

The active upgrade moments are:

1. After Score
2. After check-in
3. AI Workout
4. Dad Days usage
5. Progress/trend insight
6. Score Detail Sheet
7. Weekly report tease

Do not make a paywall the first element of a feature.

Do not use aggressive or repetitive upselling.

Locked previews should explain what additional value Pro provides.

---

# Weekly Report

Today may show the compact weekly card only on its configured report day/time (currently Sunday after 08:00). Free users receive the approved tease; Pro users receive the report summary. Historical score/report content stays in the Score Detail Sheet. Do not add a second weekly report surface to Today.

---

# Native Integrations

M4 established the current native integration baseline.

Maintain existing approved functionality for:

* Apple HealthKit
* Google Health Connect
* native subscriptions
* OneSignal push
* deep links
* native authentication
* biometrics
* offline support

Do not replace working native integrations with unrelated alternatives without approval.

---

# Authentication

Supabase Auth is shared between web and mobile.

Mobile supports:

* email/password
* Google OAuth using PKCE
* native Apple Sign In
* biometric convenience login
* auth-aware deep-link continuation

Rules:

* never store passwords
* never expose service-role credentials
* never display raw provider/internal auth errors
* preserve session isolation during sign-out/account switching

---

# Offline

Offline support is mobile-only and user-scoped.

Maintain:

* per-user cached data
* queued writes where supported
* replay on reconnect
* no cross-account cache leakage
* cache/queue clearing on sign-out
* guarded network-only writes

Use the existing centralized connectivity experience.

Do not create additional permanent connectivity banners.

---

# Push Notifications

Server-side dispatch belongs to the web/backend layer.

Mobile handles:

* OneSignal device/user linking
* notification-open routing
* auth/loading-aware pending navigation
* destination compatibility
* production-safe messaging

Push notifications are not a replacement for a future in-app activity/notification centre.

---

# Error Handling

Production user-facing errors must:

* name the affected feature/action
* provide a useful next step
* avoid raw provider/database/API details
* never expose stack traces, tokens or environment variables
* avoid vague placeholder messages

Use the existing centralized error/connectivity patterns.

Do not create a new error surface for every screen.

---

# Database and Security

Use targeted Supabase migrations.

Do not reapply the full schema to production.

Rules:

* no secrets in source control
* no service-role keys in mobile
* no raw tokens in logs or UI
* least privilege for database functions and RLS
* preserve idempotency for retries, webhooks and queued writes
* prefer targeted changes over broad refactors

New third-party dependencies require review.

Do not add a dependency when platform/runtime functionality already solves the problem cleanly.

---

# Development Workflow

For active product formation/refinement:

1. Inspect existing web/backend behavior.
2. Inspect the current mobile implementation.
3. Read the active milestone requirement.
4. Apply the latest addendum where it overrides the milestone.
5. Identify:

   * Keep
   * Modify
   * Remove
   * Add
6. Separate UI changes from backend/schema/product changes.
7. Flag genuinely undefined behavior instead of guessing.
8. Wait for approval where required.
9. Change only the approved unit.
10. Run focused regression tests and typecheck.
11. Return to review mode.

Do not turn a focused product request into an unrelated architecture refactor.

---

# Documentation Rule

This file describes the **current development rules and product architecture relevant to the mobile client**.

M4 is recorded only as the completed baseline.

Historical TestFlight briefs, old milestone checklists and superseded Jamie decisions must not be treated as current requirements.

When a new approved milestone or addendum changes product behavior, update this file so outdated rules are removed or clearly superseded.
