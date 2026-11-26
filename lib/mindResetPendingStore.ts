import * as SecureStore from 'expo-secure-store';
import type { OfflineMindResetItem } from './offlineStorage';

/**
 * Second, independent durable store for Mind Reset completions the offline queue could not save
 * (the queue is one AsyncStorage entry). The device keychain survives app termination and restart.
 * Items are tiny (id, owner, time, seconds) and capped, well under the keychain value limit.
 * Every function reports failure instead of throwing, so callers fall back to memory honestly.
 */
const MAX_HELD = 8;
const key = (userId: string) => `dadhealth.mindreset.pending.${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;

function valid(item: unknown, userId: string): item is OfflineMindResetItem {
  const value = item as OfflineMindResetItem | null;
  return Boolean(value && value.kind === 'mind_reset_complete' && value.userId === userId && typeof value.id === 'string'
    && value.payload && typeof value.payload.completedAt === 'string' && Number.isInteger(value.payload.activeSeconds));
}

export async function readHeldMindResets(userId: string): Promise<OfflineMindResetItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(key(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => valid(item, userId)) : [];
  } catch {
    return [];
  }
}

/** Saves the full held list for this account. Returns false when the keychain is unavailable. */
export async function writeHeldMindResets(userId: string, items: OfflineMindResetItem[]): Promise<boolean> {
  try {
    const own = items.filter((item) => valid(item, userId)).slice(-MAX_HELD);
    if (own.length) await SecureStore.setItemAsync(key(userId), JSON.stringify(own));
    else await SecureStore.deleteItemAsync(key(userId));
    return true;
  } catch {
    return false;
  }
}

export async function clearHeldMindResets(userId: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key(userId)); } catch { /* nothing durable to clear */ }
}
