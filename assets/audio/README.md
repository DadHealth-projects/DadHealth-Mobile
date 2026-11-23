# Mind Reset - original bell

Current sound: an original soft meditation bell created for Dad Health by
additive synthesis in `scripts/mindResetBell.mjs` (no recorded or third-party
audio). Approved by the project owner on 2026-11-23 (Option A, minute chimes).
Ownership terms for distribution remain the project owner's to confirm.

Bell: G4 (392 Hz) fundamental with a slightly detuned twin (~1.6 Hz shimmer),
inharmonic partials at 2.756x, 5.404x and 8.933x, a 12 ms soft-mallet attack
and a 4.0-second natural decay. Source: `mind-reset-bell-source.wav`, mono
16-bit PCM at 16 kHz.

Processing: 20 ms attack fade, 100 ms end fade, peak normalization to 0.6
full scale (about -4.44 dBFS).

Regenerate: `node scripts/generate-mind-reset-tone.mjs` (deterministic).
The bundled `mind-reset-provisional.wav` contains one bell at elapsed seconds
0, 60, 120, 180, 240 and 300, with silence between. Duration: 310 seconds.
The session completes visually at 300 seconds; the final bell then plays
(300-304 s) as the completion chime, followed by silence. The 310-second length
is kept because playback's missed-end fallback ends the session when native
position reaches 310 seconds; nothing audible plays after the completion bell.
Native playback owns timing, including when muted.

Rollback only: `mind-reset-chime.mp3` (user-supplied, replaced 2026-11-18) and
its decode `mind-reset-chime-source.wav` are retained for review rollback and are
no longer used by the app or the generator. Their creator, source URL and licence
were never independently established; do not distribute or reuse them outside
this project. Remove them once the new bell is accepted.

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
