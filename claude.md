# CLAUDE.md — DadHealth Mobile

# Project Rules

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

## Final Polish and Product Improvements

The screen migration and cross-screen code audit are complete. No standalone web product screens remain to migrate.

Dad Health Pro remains an existing Dashboard subsection and must not be rebuilt as a separate native screen.

Work in this milestone must continue incrementally:

1. Review one product improvement or polish group.
2. Explain the current behavior and the proposed change.
3. Recommend Keep, Modify, Remove or Replace.
4. Wait for explicit approval.
5. Implement only the approved group.
6. Run focused regression checks.
7. Report changed files and return to review mode.

Priority order:

1. Resolve approved Deferred Product Improvements.
2. Cross-screen accessibility and safe-area verification.
3. Loading, empty, authentication, Pro and error-state consistency.
4. Performance and unnecessary-query review.
5. Final iOS and Android regression testing.

Out of scope unless explicitly requested:

- App Store or Google Play submission
- StoreKit or native subscription implementation
- Stripe or payment-flow changes
- App Review preparation
- Release planning
- New product features not already approved

---

# Navigation

Keep the current native navigation.

Bottom Tabs

- Fit
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
