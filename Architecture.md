# ARCHITECTURE.md — DadHealth

## Purpose

DadHealth is one product delivered through two clients:

* **Web:** Next.js application deployed on Vercel
* **Mobile:** React Native / Expo application for iOS and Android

Both clients share the same Supabase project, user accounts, business data and product rules.

The web/backend implementation is the source of truth for backend contracts, business rules and canonical product calculations.

The mobile application is responsible for native presentation, native platform integrations, local state, offline behavior and mobile-specific capabilities.

---

# Repositories

## Web — dadHealth

Primary responsibilities:

* Next.js App Router application
* Supabase data and authentication
* Server/API routes
* Admin tools
* Stripe web subscriptions
* Native subscription entitlement/backend support
* Push notification dispatch
* AI-backed product features
* Database schema, RLS and migrations
* Canonical Dad Health Score calculations

Important areas:

* `src/app/`
* `src/app/api/`
* `src/components/`
* `src/hooks/`
* `src/lib/`
* `src/types/`
* `supabase/migrations/`
* `supabase/schema.sql`
* `supabase/rls-policies.sql`
* `tests/`

## Mobile — dadhealth-mobile

Primary responsibilities:

* React Native / Expo application
* Native navigation
* Native UI and screen presentation
* Supabase authenticated client access
* Offline cache and queued writes
* Push notification lifecycle and routing
* Apple HealthKit
* Google Health Connect
* Native subscriptions
* Deep links
* Native authentication
* Biometrics

Important areas:

* `App.js`
* `navigation/`
* `contexts/`
* `screens/`
* `screens/subscreens/`
* `components/`
* `hooks/`
* `lib/`
* `tests/`
* `app.json`
* `eas.json`

---

# Architecture

```text
                         ┌─────────────────────┐
                         │      Supabase       │
                         │ Postgres / Auth /   │
                         │ RLS / Storage       │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
           ┌────────▼────────┐             ┌─────────▼─────────┐
           │  Next.js Web    │             │ React Native App  │
           │    + APIs       │             │      / Expo       │
           └────────┬────────┘             └─────────┬─────────┘
                    │                                │
        ┌───────────┼────────────┐       ┌───────────┼──────────────┐
        │           │            │       │           │              │
     Stripe      AI APIs       Admin   HealthKit  Health Connect  OneSignal
      Web        / server      tools      iOS        Android       Push
        │
 Native subscription
 verification/support
```

The mobile client must not duplicate privileged server logic.

Anything requiring secrets, service-role access, store verification, privileged notification delivery or protected server operations belongs in the web/backend layer.

---

# Current Milestone State

## Completed Baseline

**M4 — Phase 3 Native Integration & Refinement Pass**

M4 is completed, approved and paid.

The existing native integrations and architecture established during M4 should be preserved unless the current milestone explicitly changes them.

## Active Product Formation

**Next Milestone Brief — Dad Health Journey & Personalisation Formation**

Latest amendment:

**Brief Addendum A — Merge Score into Today**

The active milestone changes the product journey in several places. Architecture should support those changes without unnecessarily rewriting the existing native infrastructure.

---

# Source of Truth

## Product Behavior

Use the current approved milestone documents and web/backend implementation for:

* business rules
* feature behavior
* Score calculations
* database contracts
* entitlement rules
* quotas
* recommendation logic
* canonical product data

## Native Presentation

Use the current approved mobile UI and native design direction for:

* layout
* visual hierarchy
* spacing
* typography
* interaction patterns
* navigation presentation
* phone-first UX

Do not copy the web page hierarchy onto mobile.

## Historical Documents

Older milestone briefs and TestFlight feedback are not architecture authority when they conflict with the current milestone or Addendum A.

---

# Navigation Architecture

The current user-facing bottom navigation is:

```text
Today | Mind | Body | Bond | Community
```

There is no user-facing Score tab.

## Score

Score is presented from Today.

```text
Today
  │
  └── Dad Health Score
          │
          └── Score Detail Sheet
```

The Score Detail Sheet contains historical and detailed Score information that previously belonged to the Score experience.

Existing internal route names may remain for compatibility where required by:

* notifications
* deep links
* navigation state
* existing screen references

Internal route names should not be changed casually.

Legacy Score destinations should resolve to the current Today/Score Detail experience rather than restoring a standalone Score tab.

## + LOG

The centre navigation position may be used for a raised `+ LOG` action.

When enabled:

```text
+ LOG
├── Log workout
├── Log Bond time
└── Log Mind activity
```

The centre action is conditional on explicit product confirmation.

It is not a navigation tab.

---

# Dad Health Score Architecture

Dad Health Score consists of:

* Mind
* Body
* Bond

The Score is server-owned.

The client consumes canonical values rather than reproducing the scoring formula.

The canonical Score source supplies:

* total Score
* pillar Scores
* trends
* weakest pillar
* recommended action

Consumers include:

* Today Score card
* Your One Focus
* Score Detail Sheet
* Mind
* Body
* Bond
* weekly reporting

No individual screen should calculate a separate Score.

No Score or trend value should be hardcoded for demonstration purposes.

---

# Score Detail Sheet

The Score Detail Sheet is the mobile presentation for detailed Score information.

Expected structure:

```text
Score + Pillars
      ↓
What feeds each pillar
      ↓
Pro insight / improvement tease
      ↓
Score trend history
      ↓
Monthly report card
      ↓
Badges
      ↓
Share Report
```

The sheet is opened from Today.

Historical Score information should not be duplicated into a second standalone Score tab.

---

# Today Architecture

Today is the primary daily hub.

Current product hierarchy:

```text
Greeting
↓
Dad Health Score
↓
Pro tease
↓
Daily Check-in
↓
Your One Focus
↓
Streak
↓
Weekly Card on report day
↓
Supporting Tools
↓
Challenge
```

Today is responsible for the current-day journey.

Historical information belongs in the Score Detail Sheet or the relevant pillar.

---

# Pillar Architecture

## Mind

Mind is action-first.

It owns:

* immediate Mind actions
* daily mood information
* sleep quality
* mood trends/history
* mood correlation/pattern insights
* journal
* crisis support
* support/community pathways

Crisis support must remain accessible without login.

## Body

Body owns:

* workouts
* AI Workout
* Meal Planner
* TDEE/calorie calculation
* Workout Library
* wearable activity
* manual workout logging

Wearable information is secondary to the primary Body feature experience.

## Bond

Bond owns:

* Present Dad Mode
* Dad Days
* Cook Together
* manual Bond logging

Removed legacy features must not be reintroduced without a new approved requirement.

## Community

Community is a separate product area and remains accessible to both Free and Pro users.

Current community direction:

**Every Kind of Dad**

---

# Activity Logging Architecture

Manual activity logging is shared across the three Score pillars.

The backend activity-log model includes the equivalent of:

```text
activity_logs
├── user_id
├── pillar
├── activity_type
├── duration_minutes
├── intensity
├── contact_day
├── notes
├── logged_at
└── backdated_at
```

Exact database types and constraints remain owned by the backend/schema.

## Body

Logs physical activities with:

* activity type
* duration
* intensity
* date
* notes

Backdating is supported up to seven days.

## Bond

Logs approved Bond activities such as:

* routine
* play
* active
* out & about
* remote
* other

Contact-day information is supported where required.

## Mind

Logs approved Mind activities such as:

* professional support
* mindfulness
* social connection
* nature/recovery
* other

Manual activity logs feed the canonical Score system.

---

# Score Recalculation

Score recalculation belongs to the backend/canonical Score service.

Relevant product events can trigger recalculation, including:

* manual activity logging
* daily check-in submission
* other approved score-affecting activity

A nightly recalculation provides consistency.

Mobile should request or consume updated canonical values rather than attempting to reproduce the backend formula.

---

# Entitlements

Free/Pro entitlement decisions belong to the product/backend layer.

Mobile should consume entitlement state and present the appropriate experience.

Do not hardcode subscription entitlement rules independently across screens.

Current product direction includes:

* Free core Score
* Free daily check-in
* Free Mind basics
* Free basic Body workouts
* Free manual activity logging
* limited Free Dad Days
* full Community access
* Pro personalisation
* Pro historical/trend insights
* Pro AI Workout
* Pro expanded Dad Days
* Pro weekly report
* Pro streak protection
* Pro monthly report card

The current milestone brief is authoritative for exact entitlement behavior.

---

# Authentication

Supabase Auth is shared by web and mobile.

Mobile authentication includes:

* email/password
* Google OAuth using PKCE
* native Apple Sign In
* biometric convenience login
* auth-aware deep-link continuation

Security rules:

* never store passwords
* never expose service-role credentials
* never expose raw provider errors
* preserve session isolation across sign-out/account switching

---

# Offline Architecture

Offline functionality is mobile-only and user-scoped.

Current architecture supports:

* per-user cached data
* queued writes where supported
* reconnect replay
* account isolation
* clearing private cache/queues on sign-out
* guarded network-only operations

Do not create parallel offline systems for individual screens.

Connectivity UX should remain centralized.

---

# Push Notifications

Push dispatch is owned by the web