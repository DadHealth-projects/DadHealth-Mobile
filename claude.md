# CLAUDE.md — DadHealth Mobile

# Project Rules

## Production Error Copy

- Every user-facing error must name the affected feature or action and give the
  user a useful next step.
- Never show implementation or development details in the client, including
  internal provider names such as Supabase or OneSignal, storage mechanisms,
  native modules, API/schema/database details, tokens, environment variables,
  build instructions, Expo Go, stack traces or raw caught error messages.
- Technical diagnostics belong in development logs only. Map failures to stable,
  production-ready copy before rendering them.
- Screen-level load errors must name the current screen or content. Do not reuse
  Dashboard wording on Body, Mind, Bond, Squad, Progress or settings screens.
- Do not use placeholder error copy such as "Something went wrong" or "An error
  occurred." State what failed and what the user can do next.

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

## Screen Migration Milestone

Completed.

All standalone native product screens, focused sub-screens, account flows and dashboard subsections have been migrated and reviewed.

The codebase security and organization audit is also complete:

- Native tab screens live directly in `screens/`.
- Stack, detail, authentication, onboarding and settings screens live in `screens/subscreens/`.
- Known npm dependency vulnerabilities were remediated without forcing an Expo major upgrade.
- Biometric login stores a revocable Supabase refresh token, never a password.
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
- Native subscription flow before App Store submission
- TDEE calculation history and body-value logging
- Non-contact Days card and its wording versus reduced non-custody Bond Score weighting
- Progress badge catalogue fallback is labelled as earned when no earned badges exist

These items may be considered during Final Polish, but only one at a time after review and explicit approval.

---
# Next Milestone

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

## Planned Order

1. Push Notifications (OneSignal)
2. Apple HealthKit (iOS)
3. Google Health Connect (Android)
4. Native Stripe Payment Sheet
5. Apple Pay
6. Google Pay
7. Offline Mode
8. Deep Links
9. Final iOS / Android testing

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

Keep the current native navigation.

Bottom Tabs

- Body
- Mind
- Home
- Bond
- Squad

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
