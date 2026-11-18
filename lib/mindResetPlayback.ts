// Native position is the only clock. There are no JavaScript cue timers.
export type ResetPlayer = {
  currentTime: number; currentStatus: ResetStatus; isLoaded: boolean; muted: boolean; loop: boolean;
  play(): void; pause(): void; remove(): void; release(): void; seekTo(seconds: number, before?: number, after?: number): Promise<void>;
  addListener(event: 'playbackStatusUpdate', listener: (status: ResetStatus) => void): { remove(): void };
};
export type ResetStatus = { currentTime: number; playing: boolean; isLoaded: boolean; didJustFinish: boolean; error?: string | null; mediaServicesDidReset?: boolean };
export type ResetView = { seconds: number; running: boolean; preparing: boolean; error: string | null; finished?: boolean };
export function createResetPlayback(
  createPlayer: () => ResetPlayer,
  acquire: () => Promise<() => Promise<void>>,
  emit: (view: ResetView) => void,
) {
  let player: ResetPlayer | null = null;
  let listener: { remove(): void } | null = null;
  let release: (() => Promise<void>) | null = null;
  let generation = 0;
  let position = 0;
  let disposed = false;
  let preparing = false;
  let muted = false;
  let ended = false;
  let receive: ((status: ResetStatus) => void) | null = null;
  const publish = (running = false, error: string | null = null) => {
    if (!disposed) emit({ seconds: Math.min(300, Math.floor(position)), running, preparing, error, finished: ended });
  };
  const detach = () => {
    generation++;
    preparing = false;
    listener?.remove(); listener = null;
    receive = null;
    const old = player; player = null;
    // Removal also takes this player out of expo-audio's interrupted-player registry.
    if (old) { try { old.pause(); } finally { old.remove(); old.release(); } }
    const unlock = release; release = null;
    if (unlock) void unlock();
  };
  const fail = () => { detach(); publish(false, 'Audio could not start. Please try again.'); };
  return {
    async start() {
      if (disposed || ended || preparing) return;
      if (player) { player.play(); return; }
      preparing = true; publish();
      const request = ++generation;
      const valid = () => !disposed && request === generation;
      try {
        const unlock = await acquire();
        if (!valid()) { await unlock(); return; }
        release = unlock;
        const next = createPlayer(); player = next;
        next.muted = muted; next.loop = false;
        let starting = false;
        const begin = async () => {
          if (starting || !valid()) return;
          starting = true;
          try {
            // Exact seek resumes at the saved frame, never at an earlier cue boundary.
            if (position > 0) await next.seekTo(position, 0, 0);
            if (!valid()) return;
            preparing = false; next.play(); publish(true);
          } catch { if (valid()) fail(); }
        };
        receive = status => {
          if (!valid()) return;
          if (status.error || status.mediaServicesDidReset) { fail(); return; }
          if (preparing) { if (status.isLoaded) void begin(); return; }
          position = Math.max(position, status.currentTime);
          if (status.didJustFinish || status.currentTime >= 310) {
            position = 300; ended = true; detach(); publish();
          } else publish(status.playing);
        };
        listener = next.addListener('playbackStatusUpdate', receive);
        if (next.isLoaded) void begin();
      } catch { if (valid()) fail(); }
    },
    pause() {
      if (disposed || ended) return;
      if (player) { player.pause(); position = Math.max(position, player.currentTime); }
      detach(); publish();
    },
    setSound(on: boolean) { muted = !on; if (player) player.muted = muted; },
    reconcile() { if (player) receive?.(player.currentStatus); },
    dispose() { disposed = true; detach(); },
  };
}
