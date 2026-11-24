import { createResetPlayback, type ResetPlayer, type ResetView } from './mindResetPlayback';

/** Shortest active time that counts towards the Mind score (client decision: "Finish here" after 60 s counts). */
export const MIND_RESET_MIN_RECORD_SECONDS = 60;

export function createMindResetOwner(
  createPlayer: () => ResetPlayer,
  acquire: () => Promise<() => Promise<void>>,
  onComplete?: (activeSeconds: number) => void,
) {
  const initial = { seconds: 0, running: false, preparing: false, error: null, started: false, finished: false };
  let state: ResetView & { started: boolean; finished: boolean } = initial;
  let disposed = false;
  let sound = true;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  // One record per run: a natural finish followed by "Done" must not count twice.
  let recorded = false;
  const record = (seconds: number) => {
    if (recorded || disposed || !onComplete || seconds < MIND_RESET_MIN_RECORD_SECONDS) return;
    recorded = true;
    onComplete(Math.min(300, Math.floor(seconds)));
  };
  const make = () => createResetPlayback(createPlayer, acquire, view => {
    if (disposed) return;
    state = { ...view, started: state.started, finished: Boolean(view.finished) };
    if (state.finished && state.started) record(state.seconds);
    notify();
  });
  let playback = make();
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() {
      if (disposed || state.finished) return;
      state = { ...state, started: true }; notify();
      void playback.start();
    },
    pause() { if (!disposed) playback.pause(); },
    end() {
      if (disposed) return;
      if (state.started) record(state.seconds);
      recorded = false;
      playback.dispose(); playback = make(); playback.setSound(sound); state = initial; notify();
    },
    setSound(on: boolean) { sound = on; if (!disposed) playback.setSound(on); },
    reconcile() { if (!disposed) playback.reconcile(); },
    dispose() { disposed = true; playback.dispose(); listeners.clear(); },
  };
}
