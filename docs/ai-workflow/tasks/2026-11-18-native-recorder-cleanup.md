# Native recorder cleanup correction

- User authorization: reported native shared-object `get` error and requested "fix". Local correction only; human review pending.
- Instructions/workflow/baseline/engineering memory reviewed. Preserve pending Mind Plan, Reset audio, onboarding and configuration changes. No redesign or backend changes.
- Confirmed source defect: `QuickFixSession.deleteRecording` awaited preparation/stop, then read `recorder.uri` outside its catch. Installed expo-audio `useAudioRecorder` uses `useReleasingSharedObject`, which releases the native recorder on unmount. An asynchronous cleanup can therefore read the getter after release and reject without handling.
- Correction: guard that getter and use the URI already cached during recording. Temporary file deletion and audio ownership release still run. No dependency patches or native configuration changes.
- Regression: execute the real cleanup callback with native release and stop rejection during the await, both with and without a cached URI; assert no rejection, one stop, cached deletion and ownership release, including duplicate cleanup.
- `node --test tests/mindResetAudio.test.mjs tests/mindJournalQuickFixes.test.mjs`: 19 passed, 0 failed.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- Scoped diff check: passed. No commit, build, deployment or production action.
- Device reproduction not performed. User log lacks a component stack, so this is a confirmed matching cleanup race, not proof that every possible shared-object error has the same source. Reload Metro and test opening/closing Voice Note, including while preparation/recording is active.
