# Dad Health engineering instructions

React Native / Expo client; shared web/backend is `../dadHealth`. Read [technical rules](claude.md).

## Engineering safeguards

- Inspect the current code and Git status first. Preserve unrelated staged and unstaged work, including existing deletions. Do not restore whole files to discard another change.
- Make only requested changes. Investigate evidenced causes before fixing defects; avoid speculative fixes and unrelated refactoring.
- Preserve account isolation, server-verified ownership, access controls and private-data cleanup. Discard stale responses and queued actions after account changes.
- Shared backend contracts own canonical scoring, calendar rules, entitlements and durable state. Do not duplicate privileged calculations in clients or fabricate missing data.
- Treat auth, subscriptions, RLS, grants and migrations as sensitive. Never expose credentials. Use forward migrations; do not rewrite applied migrations or apply a combined schema as a shortcut.
- Preserve durable retries and reconciliation. Only claim success after server confirmation; distinguish provider acceptance from device receipt and account removal from completed cleanup.
- Keep ordinary feature titles, descriptions and layouts stable. Use action-level progress; avoid default loading/unavailable/Retry cards. Preserve loaded content during refresh, without exposing restricted data when access is unknown. Never hide failures or leave endless pending states.
- Run focused relevant tests, TypeScript where appropriate and diff checks. Investigate failures individually; do not weaken assertions. Separate source, mocked, database, provider and device evidence.
- No production writes, builds, deployment, commits or pushes without explicit authorisation. Read-only requests permit no file changes.

## Local records and distribution

Local product references, workflow records and signing material are excluded from Git. Technical work must not depend on those records being present. For handoff ZIPs, explicitly exclude `/product/`, `/public/product/`, `/docs/ai-workflow/`, dependencies, credentials, environment secrets, signing material and diagnostic exports; Git ignore rules alone do not filter arbitrary ZIP tools. Review the archive file list before distribution.

Mobile archives must additionally exclude `/.agents/skills/dadhealth-workflow/`, `/credentials*.json`, `/ipa-check/` and `/dadhealth-install.log`. Preserve local signing configuration, including unrelated `eas.json` changes.
