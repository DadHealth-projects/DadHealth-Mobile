export function createSoundPreferences(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> }) {
  const values = new Map<string, boolean>();
  const versions = new Map<string, number>();
  const writes = new Map<string, Promise<unknown>>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const key = (owner: string) => `mind-reset-sound:${owner}`;
  return {
    get: (owner?: string) => owner ? values.get(owner) ?? true : true,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async load(owner: string) {
      if (values.has(owner)) return;
      const version = versions.get(owner) ?? 0;
      const stored = await storage.getItem(key(owner));
      if ((versions.get(owner) ?? 0) !== version) return;
      values.set(owner, stored !== 'off'); notify();
    },
    async set(owner: string, on: boolean) {
      versions.set(owner, (versions.get(owner) ?? 0) + 1);
      values.set(owner, on); notify();
      const write = (writes.get(owner) ?? Promise.resolve()).catch(() => undefined)
        .then(() => storage.setItem(key(owner), on ? 'on' : 'off'));
      writes.set(owner, write);
      await write;
    },
  };
}
