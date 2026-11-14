# dadhealth-mobile verification baseline

Recorded 2026-11-12 from the preceding test-discovery audit/verification in this conversation; tests were not rerun for this documentation task.
Audit HEAD: `c38161a1c169c85e2ce72cc459758a2f9e738ea1`. HEAD was rechecked during workflow setup and matches.
Audit working-tree delta: `package.json` test script changed to `node --test "tests/*.test.mjs"`; that change remains uncommitted. These results describe that working tree, not pristine HEAD alone.
Runtime observed: Node v26.13.0, Windows PowerShell; `npm.cmd test` invoked npm without PowerShell script-policy issues.

| Node files | Cases | Passed | Failed |
|---|---|---|---|
| 56 | 297 | 263 | 34 |

`npm test` exited 1 due to test failures, with zero skipped/cancelled cases. Mobile TypeScript passed.
`git diff --check` passed after the test-script edit. SQL, deployed behaviour and device behaviour were not verified by this baseline.

## Commands (from repository root)

```text
npm test
node node_modules/typescript/bin/tsc --noEmit --incremental false
git diff --check
```

## Use and refresh

These are observed failures, not accepted permanent failures or permission to weaken tests.
The previous chat audit contains individual case names/messages; no separate durable raw test log was retained. Do not infer missing details from counts. Capture exact names/messages and commands in the next authorised verification record.
Refresh observations when the checkout, dirty files, runtime or dependencies change. Record HEAD plus working-tree scope, date, commands and environment; keep the old observation for comparison. Compare individual failures as well as totals; equal counts do not prove no regressions.
