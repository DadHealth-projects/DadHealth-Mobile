# Mind Reset - user-supplied chime

Current source: user-supplied `mind-reset-chime.mp3`, replaced 2026-11-18.
Duration decoded: 7.488 seconds. Creator/source URL/licence of this replacement
have not been independently established. The earlier Pixabay attribution
applied to the previous file and must not be assumed for this replacement.
Confirm replacement provenance before distribution.

Decoded locally using Chromium Web Audio to mono 16-bit PCM at 16 kHz:
`mind-reset-chime-source.wav`. Retained for deterministic regeneration.
Processing: 20 ms attack fade, 100 ms end fade, peak normalization to 0.6
full scale (about -4.44 dBFS). Complete recording retained; no overlapping cues.

Regenerate: `node scripts/generate-mind-reset-tone.mjs`.
The bundled `mind-reset-provisional.wav` contains 31 repetitions starting at
elapsed seconds 0, 10, 20, ... 300, with 2.512 seconds of silence between cues.
Duration: 310 seconds. The final recording plays fully after five-minute visual
completion. Native playback owns timing, including when muted. This supersedes
the previous 15-second repeat interval; no session/navigation behaviour changes.

Visual completion is at 300 seconds; playback releases after the final tail.
Back, tab navigation and screen unmount retain the account-owned session.
Finish here, End session, logout and account changes release playback.
The compact app control can return to Reset, pause/resume or end it.
Recording requires an explicit pause and never automatically resumes Reset.
User Pause removes the native
player and resumes with an exact seek to its saved position. OS interruptions
use expo-audio's standard pause/automatic-resume behaviour; no JS catch-up cues
are queued. A media-service reset fails safely rather than intentionally replaying
the session. Audio mode is shared exclusively with the disposable voice recorder.

Background playback requires a new native build with the updated expo-audio
plugin configuration. No lock-screen transport controls are added: expo-audio
requires exclusive audio mode for those controls, which conflicts with mixing.
Android sustained background playback with mixing is not guaranteed by the
installed library; its documented lock-screen-control requirement needs separate
resolution if Android locked playback is required. iPhone lock/silent-switch,
mixing, interruptions and muted background execution still require device tests.
