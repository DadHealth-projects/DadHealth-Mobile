import { createResetPlayback, type ResetPlayer, type ResetView } from './mindResetPlayback';

export function createMindResetOwner(createPlayer: () => ResetPlayer, acquire: () => Promise<() => Promise<void>>) {
  const initial = { seconds: 0, running: false, preparing: false, error: null, started: false, finished: false };
  let state: ResetView & { started: boolean; finished: boolean } = initial;
  let disposed = false;
  let sound = true;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const make = () => createResetPlayback(createPlayer, acquire, view => {
    if (disposed) return;
    state = { ...view, started: state.started, finished: Boolean(view.finished) };
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
      playback.dispose(); playback = make(); playback.setSound(sound); state = initial; notify();
    },
    setSound(on: boolean) { sound = on; if (!disposed) playback.setSound(on); },
    reconcile() { if (!disposed) playback.reconcile(); },
    dispose() { disposed = true; playback.dispose(); listeners.clear(); },
  };
}
