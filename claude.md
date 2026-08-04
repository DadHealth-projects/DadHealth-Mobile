I would reduce `CLAUDE.md` dramatically. Right now it's become a project history document instead of an instruction document. Keep it focused on **how to work**, **current state**, and **next task**.

Something like this:

---

# CLAUDE.md — DadHealth Mobile

## Project Rules

* The **web app** is the source of truth for:

  * Features
  * Business logic
  * Calculations
  * Supabase queries
  * Copy

* The **App Store mockups** are the source of truth for:

  * Layout
  * UI
  * UX
  * Spacing
  * Typography
  * Component styling

Never copy the web layout onto mobile.

---

# Migration Workflow

Work one component at a time.

For every component:

1. Read the web component.
2. Explain exactly what it does.
3. Compare it with the current mobile version.
4. Recommend:

   * Keep
   * Modify
   * Remove
   * Replace
5. Wait for approval.
6. **Only after approval, enter coding mode and update that component.**
7. Stop coding.
8. Explain what changed.
9. Return to review mode.
10. Continue with the next component.

Never implement multiple components without approval.

---

# Current Status

## ✅ Completed

### Public Home

Completed using the App Store mockup as the design reference while preserving web functionality.

Changes include:

* Mockup hero
* Left-aligned Dad Health logo
* Improved logged-out onboarding section
* Dad Score preview
* Zero used instead of dash for unavailable score
* Dot placeholders for unavailable pillar values
* Mood preview
* Community count
* Start Free CTA
* Statistics
* Pillars section

---

### Dashboard (Logged-in)

Dashboard migration is complete.

Reviewed and approved component by component.

Includes:

* Header
* Dad Score
* Daily Check-in
* Today's Plan
* Mood This Week
* Smart Reminders
* Weekly Challenge
* Upgrade Pro
* Navigation
* Loading
* Empty states
* Error states

Dashboard now follows the mockup design while preserving web logic.

---

# Deferred Product Improvements

These are intentionally **not** part of migration.

* Today's Plan onboarding mismatch
* Mood week weekday labels
* Native subscription flow before App Store submission

Do not solve these during migration.

---

# Next Task

Continue migrating standalone screens.

Order:

1. Fitness
2. Mind
3. Bond
4. Squad (Community)
5. Progress (if needed)

Follow the review workflow for every component.

---

# Navigation

Keep the current native navigation.

Bottom Tabs

* Fit
* Mind
* Home
* Bond
* Squad

Secondary screens remain inside the account/profile menu.

Do not introduce a hamburger menu unless explicitly requested.

---

# Important

This file is **not** a changelog.

Do not document every implementation detail here.

Keep it updated with only:

* Project rules
* Current completed work
* Remaining work
* Workflow

Remove historical notes once they are no longer relevant.