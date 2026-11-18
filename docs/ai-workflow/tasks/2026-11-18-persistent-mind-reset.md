# Item 04 - account-owned Mind Reset

User authorized persistent playback across Back/tab navigation, superseding stop-on-navigation. Preserve audio, account isolation and Mind Plan completion rules. Local implementation only; human/device review pending.

Cause: the screen hook disposed playback whenever focus changed; Back also called Finish here. Root now owns a provider keyed by authenticated user. Its external store retains the controller and native position while UI subscribers mount/unmount. Back only navigates. Finish here/End disposes playback and resets the owner state; account teardown disposes old work and guards late callbacks. Final audio tail releases at 315 seconds. Existing pause removes its player and resumes at the saved native frame; never more than one live player.

Added compact root controls to return, pause/resume and end. Existing styling and safe-area padding used. The recorder presents an explicit Pause Mind Reset action. Exclusive audio ownership still rejects concurrent recording/playback; recording never silently ends or resumes Reset. No plan completion requests are introduced.

Files: lib/mindResetOwner.ts, contexts/MindResetContext.tsx, components/MindResetControls.tsx (new); hooks/useMindResetSession.ts, lib/mindResetPlayback.ts, lib/audioOwnership.ts, contexts/RootNavigator.tsx, screens/subscreens/BreathingSessionScreen.tsx, components/mind/MindQuickFixes.tsx, tests/mindResetAudio.test.mjs, assets/audio/README.md. Preserve pre-existing diffs in shared files.

Executed: node --test tests/mindResetAudio.test.mjs tests/mindFormation.test.mjs tests/mindJournalQuickFixes.test.mjs tests/mindPlanIntegration.test.mjs
57 passed, 0 failed/skipped/TODO. Native objects are mocks; track PCM tests inspect actual bundled audio.
TypeScript: node node_modules/typescript/bin/tsc --noEmit --incremental false passed.
git diff --check passed (existing line-ending warnings).

Device pending: begin/back/tabs/reopen without restart; pause/resume away; end/Finish here; final tail; lock/background and silent-switch/music mixing; muted playback; OS interruption; logout/account switch; recording pause/resume; compact control placement at large text and with native sheets. No native build/deployment/device acceptance claimed. No commits, pushes, SQL, scoring, subscription or plan-progression changes.
