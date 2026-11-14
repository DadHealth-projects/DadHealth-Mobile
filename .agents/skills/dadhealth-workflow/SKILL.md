---
name: dadhealth-workflow
description: Guide Dad Health milestone and engineering tasks through investigation, approved plans, scoped implementation, verification and human review. Use for new tasks or resuming a recorded task in the mobile or shared backend repository.
---

# Dad Health workflow

## Entry points

- New milestone/task: read the target repository's AGENTS.md and Claude instructions, record requirements, then start step 1 INVESTIGATE read-only.
- Review-only: inspect and report in chat; create no records or other files.
- Resume/implement/verify: read the named task record, current Git status and baseline; resume its recorded phase rather than restarting the audit.

Read [mobile WORKFLOW.md](../../../docs/ai-workflow/WORKFLOW.md) and [BASELINE.md](../../../docs/ai-workflow/BASELINE.md). For backend work use the corresponding files under `../dadHealth` relative to the mobile repository root, including its `Claude.md` and AGENTS.md. Keep each repository's evidence in its own task record.
Use the local [task template](../../../docs/ai-workflow/tasks/TEMPLATE.md); do not duplicate workflow or architecture text.

## Gates

Follow the seven-step workflow: read-only investigation -> human findings review -> human visual plan approval -> Codex understanding (no implementation) -> separately approved implementation/testing -> human diff review -> accept or correct.
Before implementation, require the task record to show human findings review, visual plan approval, Codex's subsequent understanding and explicit human approval to implement that understanding. Codex's own plan or understanding NEVER grants permission; plan approval alone cannot skip the understanding gate.
Stop at each pending human gate. Preserve existing explicit approvals for the same gate and scope; never infer missing approval. After step 4 implementation approval, execute routine in-scope steps without repeated permission. New scope needs approval.
Compare tests against baseline, preserve device/backend acceptance requirements, and return the full diff for step 6 human review. Accept or correct at step 7 before moving forward; no automatic completion. Commit, push, build and deployment still require separate permission.

## Engineering memory

Read the target repository's [ENGINEERING_MEMORY.md](../../../docs/ai-workflow/ENGINEERING_MEMORY.md) before every task and before every step of the seven-step workflow; for backend work use its local counterpart. Identify relevant incident IDs, inspect the actual checkout and state behaviour to preserve.
Require the memory's self-correction loop: check all five patterns after meaningful changes; pause and investigate failed assumptions instead of stacking patches; review the full diff/new files, approved scope, preserved behaviour and baseline results before reporting success.
Record only genuinely new supported lessons. REVIEW-ONLY/PLAN-ONLY lessons stay in chat or an authorised task report; global memory needs separate explicit file-scope approval, including during implementation. Never silently rewrite history or update the other repo without authority. Use the task template's memory-review section; preserve all existing approval gates.
