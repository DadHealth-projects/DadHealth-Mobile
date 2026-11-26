import * as SecureStore from 'expo-secure-store';
import type { OfflineMindResetItem } from './offlineStorage';

/**
 * Second, independent durable store for Mind Reset completions the offline queue could not save
 * (the queue is one AsyncStorage entry). The device keychain survives app termination and restart.
 *
 * Every operation is serialized per account and reports what it actually achieved:
 * - a failed read is never treated as "nothing held" (that would let a later write erase items);
 * - capacity overflow is reported (never a silent drop presented as durable);
 * - a failed clear throws, so account cleanup cannot claim success while the key remains.
 * Items are tiny (id, owner, time, seconds); MAX_HELD keeps the value well under keychain limits.
 */
export const MAX_HELD = 8;
const key = (userId: string) => `dadhealth.mindreset.pending.${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;
const locks = new Map<string, Promise<unknown>>();

function serialized<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(userId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  locks.set(userId, current.then(() => undefined, () => undefined));
  return current;
}

function valid(item: unknown, userId: string): item is OfflineMindResetItem {
  const value = item as OfflineMindResetItem | null;
  return Boolean(value && value.kind === 'mind_reset_complete' && value.userId === userId && typeof value.id === 'string'
    && value.payload && typeof value.payload.completedAt === 'string' && Number.isInteger(value.payload.activeSeconds));
}

type ReadResult = { ok: true; items: OfflineMindResetItem[] } | { ok: false; items: [] };

async function readUnlocked(userId: string): Promise<ReadResult> {
  try {
    const raw = await SecureStore.getItemAsync(key(userId));
    if (!raw) return { ok: true, items: [] };
    const parsed = JSON.parse(raw);
    return { ok: true, items: Array.isArray(parsed) ? parsed.filter((item) => valid(item, userId)) : [] };
  } catch {
    return { ok: false, items: [] };
  }
}

/** Reads the held completions. `ok: false` means unknown, never "none". */
export function readHeldMindResets(userId: string): Promise<ReadResult> {
  return serialized(userId, () => readUnlocked(userId));
}

export type HeldUpdate = {
  /** The stored list could be read and the new list was written. */
  ok: boolean;
  /** Ids durably stored after the update (empty when not ok). */
  storedIds: Set<string>;
  /** Ids the update wanted to keep but could not store (capacity or failure). */
  notStoredIds: Set<string>;
};

/**
 * Read-modify-write under the account lock, so a hold and a recovery running together cannot
 * overwrite each other. Never writes when the read failed. Keeps the newest MAX_HELD items and
 * reports any older ones as not stored (they stay in memory and the app says so).
 */
export function updateHeldMindResets(userId: string,
  change: (current: OfflineMindResetItem[]) => OfflineMindResetItem[]): Promise<HeldUpdate> {
  return serialized(userId, async () => {
    const read = await readUnlocked(userId);
    if (!read.ok) {
      const wanted = change([]).filter((item) => valid(item, userId));
      return { ok: false, storedIds: new Set<string>(), notStoredIds: new Set(wanted.map((item) => item.id)) };
    }
    const wanted = change(read.items).filter((item) => valid(item, userId));
    const unique = [...new Map(wanted.map((item) => [item.id, item])).values()]
      .sort((a, b) => Date.parse(a.payload.completedAt) - Date.parse(b.payload.completedAt));
    const kept = unique.slice(-MAX_HELD);
    const dropped = unique.slice(0, Math.max(0, unique.length - MAX_HELD));
    try {
      if (kept.length) await SecureStore.setItemAsync(key(userId), JSON.stringify(kept));
      else await SecureStore.deleteItemAsync(key(userId));
    } catch {
      return { ok: false, storedIds: new Set<string>(), notStoredIds: new Set(unique.map((item) => item.id)) };
    }
    return { ok: true, storedIds: new Set(kept.map((item) => item.id)), notStoredIds: new Set(dropped.map((item) => item.id)) };
  });
}

/** Removes this account's held completions. Throws if the keychain entry could not be removed. */
export function clearHeldMindResets(userId: string): Promise<void> {
  return serialized(userId, async () => {
    await SecureStore.deleteItemAsync(key(userId));
  });
}
