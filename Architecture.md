ARCHITECTURE.md — DadHealth

Purpose

DadHealth is one product delivered through two clients:

Web: Next.js application deployed on Vercel.

Mobile: React Native / Expo application for iOS and Android.

Both clients share the same Supabase project, user accounts, business data and product rules. The web implementation is the source of truth for product behavior and backend contracts; the mobile app presents those capabilities using native UI and native platform integrations.

Repositories

Web — dadHealth

Primary responsibilities:

Next.js App Router web application

Supabase-backed product data and authentication

Server/API routes

Admin tools

Stripe web subscriptions

Native-subscription entitlement/backend support

Push-notification server dispatch

AI-backed product features

Database schema, RLS and migrations

Shared product calculations such as Dad Health Score

Important areas:

src/app/ — pages and server routes

src/app/api/ — server endpoints

src/components/ — web UI

src/hooks/ — web data hooks

src/lib/ — product/server integrations and shared logic

src/types/ — application/database types

supabase/migrations/ — targeted production migrations

supabase/schema.sql — schema mirror/reference

supabase/rls-policies.sql — RLS reference

tests/ — backend/product regression tests

Mobile — dadhealth-mobile

Primary responsibilities:

React Native / Expo application

Native navigation and screen presentation

Supabase authenticated client access

Offline cache and queued writes

Push notification lifecycle and routing

Apple HealthKit

Google Health Connect

Native subscriptions

Deep links

Native auth and biometrics

Important areas:

App.js — application bootstrap/providers

navigation/ — tab and stack navigation

contexts/ — auth, root navigation, network and app-wide state

screens/ — primary native tab screens

screens/subscreens/ — detail/auth/settings/onboarding screens

components/ — reusable native UI

hooks/ — screen/data orchestration

lib/ — native integrations, offline sync, deep links, notifications, helpers

tests/ — mobile regression tests

app.json / eas.json — native build configuration

Core Architecture

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
    Stripe      AI APIs      Admin   HealthKit  Health Connect  OneSignal
     Web       / server      tools      iOS        Android       Push
       │
 Native subscription
 verification/support

The mobile client must not duplicate privileged server logic. Anything requiring secrets, service-role access, store verification, privileged notification delivery or protected server operations belongs in the web/backend layer.

Source-of-Truth Rules

Product behavior

Use the web/backend implementation as the source of truth for:

feature behavior

business rules

score calculations

database contracts

Supabase queries when equivalent behavior is required

entitlement rules

quotas and limits

canonical product copy where applicable

Mobile presentation

Use the approved native mockups and current native design language as the source of truth for:

layout

visual hierarchy

tab presentation

spacing

typography

interaction patterns

phone-first UX

Do not copy the web page hierarchy onto mobile.

Database changes

Use targeted migrations.

Do not reapply the full schema.sql to production.

Keep schema.sql as a mirror/reference after approved migrations.

RLS changes require explicit review.

Prefer server-owned canonical calculations over duplicating score logic in clients.

Authentication

Supabase Auth is shared by web and mobile.

Mobile auth includes:

email/password

Google OAuth using PKCE

native Apple Sign In

biometric convenience login using a revocable per-device credential

auth-aware deep-link continuation

Rules:

never store a user password

never expose service-role credentials in mobile

never render provider/internal auth errors directly

preserve session isolation across sign-out/account switching

Dad Health Score

Dad Health Score is composed of:

Mind

Body

Bond

The score is server-owned through Supabase views/functions.

Current approved behavior includes:

daily check-in contributes to Mind

check-in includes mood, stress and sleep

workouts and health data contribute to Body

Bond activity contributes to Bond

completed Present Dad sessions contribute to Bond

current rolling 7 days are compared with the previous non-overlapping 7 days for trends

mobile consumes score/trend values rather than reproducing the scoring formula

No fake score/trend numbers may be hardcoded in UI.

Current Mobile Navigation

Visible bottom tabs:

Today

Mind

Score

Body

Bond

Community

Compatibility rules:

internal route names such as Home, Fit and Squad remain where required by existing navigation, notifications or deep links

Score reuses the existing Progress experience

Score is the raised lime CTA

Today remains the initial daily hub

Do not rename internal routes casually; route compatibility is part of the product contract.

Today Screen

Current approved hierarchy:

Greeting

Dad Health Score

Pro insight/preview when applicable

Today's three-question check-in

One focus

Streak

Supporting tools

Existing lower-priority stable content

One-focus mapping:

incomplete check-in first

Mind → breathing

Body → suggested workout

Bond → Present Dad Mode

No fake recommendations or user values.

Mind Screen

Current formation direction:

action/support first

keep the “1 in 8” mental-health statistic near the top as context

Crisis Support must be the first actionable item immediately after that context

breathing/reset support follows

journal remains prominent

therapist and Community remain available

mood information can sit lower

avoid large filler statistic cards at the bottom

crisis support must remain accessible without login

This ordering is a product decision and should be preserved unless Jamie explicitly changes it.

Offline Architecture

Offline support is mobile-only and user-scoped.

Current behavior:

per-user cached data

queued Home/check-in writes

queued Journal writes

replay on reconnect

no cross-account cache leakage

private cache/queue cleared on sign-out

Community cached reading where supported; network-only writes are guarded

one centralized connectivity experience instead of permanent banners

Old queued check-ins remain backward compatible if they predate newer fields such as stress.

Push Notifications

Server dispatch is controlled by the web/backend layer.

Mobile responsibilities:

OneSignal device/user linking

notification-open routing

auth/loading-aware pending navigation

destination compatibility

production-safe user messaging

Push is not a replacement for a future in-app activity/notification center.

Native Health Integrations

Apple HealthKit

Read-only:

Steps

Active Minutes / Exercise Time

Resting Heart Rate

Sleep

Google Health Connect

Read-only:

Steps

Exercise / Active Minutes

Resting Heart Rate

Sleep

Manual user-entered data must not be silently overwritten by wearable sync rules.

Subscriptions

Web

Stripe remains the web subscription/payment system.

Mobile

Digital Pro subscriptions use native store billing:

iOS → App Store / StoreKit

Android → Google Play Billing

Existing web Stripe subscribers retain Pro entitlement in mobile.

Do not replace native digital subscriptions with Stripe PaymentSheet inside store builds.

Deep Links

Current supported native contracts include:

auth callback

Community thread navigation

co-parent invite continuation

push destination routing

Universal Links and Android App Links are not part of the original required M3 contract unless later approved.

Error Handling

Production user-facing errors must:

name the affected feature/action

give a useful next step

avoid raw provider/database/API details

avoid stack traces, tokens, environment variables or implementation detail

never use vague placeholder copy when a specific message is possible

Dependency and Security Rules

Do not add a dependency when platform/runtime code already solves the problem cleanly.

New third-party libraries require explicit review.

No secrets in source control.

No service-role keys in mobile.

No raw tokens in logs or UI.

Use least privilege for database functions and RLS.

Preserve idempotency for retries/webhooks/queued writes.

Prefer targeted changes over broad refactors.

Change Workflow

For product formation/refinement:

Inspect existing web/backend behavior.

Inspect current mobile implementation.

Identify Keep / Modify / Remove / Add.

Separate UI-only work from backend/schema/product work.

Flag undefined product behavior instead of guessing.

Wait for approval.

Change only the approved unit.

Run focused regression tests and typecheck.

Return to review mode.

Do not turn a small formation request into a screen rewrite or architecture refactor.