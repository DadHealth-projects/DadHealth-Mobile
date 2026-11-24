import type { AnalyticsScope } from './analyticsQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_VERSION = 1;
const PREFIX = `dadhealth.offline.v${STORAGE_VERSION}`;

type CacheEnvelope<T> = {
  version: typeof STORAGE_VERSION;
  cachedAt: string;
  data: T;
};

export type OfflineJournalEntry = {
  id: string;
  user_id: string;
  content: string;
  prompt: string | null;
  mood_value: number;
  tag: string | null;
  created_at: string;
  sync_status?: 'pending' | 'failed';
};

export type OfflineCommunityCache<TPost> = {
  posts: TPost[];
  likedIds: string[];
  savedIds: string[];
  anonymousOwnedIds: string[];
};

type QueueItemBase = {
  id: string;
  userId: string;
  createdAt: string;
  failedMessage?: string;
};

export type OfflineDailyCheckInItem = QueueItemBase & {
  kind: 'daily_checkin';
  analytics?: AnalyticsScope | null;
  payload: {
    date: string;
    moodValue: number;
    /** Optional for older queued check-ins. */
    stressLevel?: number;
    energyLevel?: number;
    connectionLevel?: number;
    sleepHours?: number | null;
  };
};

export type OfflineJournalCreateItem = QueueItemBase & {
  kind: 'journal_create';
  payload: {
    entry: OfflineJournalEntry;
  };
};

export type OfflineMindResetItem = QueueItemBase & {
  kind: 'mind_reset_complete';
  /** The queue item id is also the server's idempotent session id. */
  payload: {
    completedAt: string;
    activeSeconds: number;
  };
};

export type OfflineQueueItem = OfflineDailyCheckInItem | OfflineJournalCreateItem | OfflineMindResetItem;

export type OfflineSyncEvent = {
  userId: string;
  kind: OfflineQueueItem['kind'] | 'all';
  status: 'synced' | 'failed' | 'cleared';
  message?: string;
};

const syncListeners = new Set<(event: OfflineSyncEvent) => void>();
const queueLocks = new Map<string, Promise<void>>();
const privateWriteLocks = new Map<string, Promise<void>>();
const blockedPrivateUsers = new Set<string>();

function privateKey(userId: string, name: 'dashboard' | 'journal' | 'community' | 'community_v2' | 'community_v3' | 'queue') {
  return `${PREFIX}.private.${userId}.${name}`;
}

function communityKey(userId?: string) {
  return userId ? privateKey(userId, 'community_v3') : `${PREFIX}.public.community.v3`;
}

async function readEnvelope<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION || !('data' in parsed)) return null;
    return parsed.data ?? null;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

async function writeEnvelope<T>(key: string, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    version: STORAGE_VERSION,
    cachedAt: new Date().toISOString(),
    data,
  };
  await AsyncStorage.setItem(key, JSON.stringify(envelope));
}

function withQueueLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const previous = queueLocks.get(userId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() => {
    if (blockedPrivateUsers.has(userId)) throw new Error('offline_user_signed_out');
    return operation();
  });
  queueLocks.set(userId, current.then(() => undefined, () => undefined));
  return current;
}

function withPrivateWriteLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const previous = privateWriteLocks.get(userId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() => {
    if (blockedPrivateUsers.has(userId)) throw new Error('offline_user_signed_out');
    return operation();
  });
  privateWriteLocks.set(userId, current.then(() => undefined, () => undefined));
  return current;
}

export function allowPrivateOfflineUser(userId: string) {
  blockedPrivateUsers.delete(userId);
}

export function blockPrivateOfflineUser(userId: string) {
  blockedPrivateUsers.add(userId);
}

export function subscribeOfflineSync(listener: (event: OfflineSyncEvent) => void) {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function emitOfflineSync(event: OfflineSyncEvent) {
  syncListeners.forEach((listener) => listener(event));
}

export function readDashboardCache<T>(userId: string) {
  return readEnvelope<T>(privateKey(userId, 'dashboard'));
}

export function writeDashboardCache<T>(userId: string, data: T) {
  return withPrivateWriteLock(userId, () => writeEnvelope(privateKey(userId, 'dashboard'), data));
}

export function readJournalCache(userId: string) {
  return readEnvelope<OfflineJournalEntry[]>(privateKey(userId, 'journal'));
}

export function writeJournalCache(userId: string, entries: OfflineJournalEntry[]) {
  return withPrivateWriteLock(userId, () => writeEnvelope(privateKey(userId, 'journal'), entries));
}

const communityCacheVersions = new Map<string, number>();
const communityCacheInvalidations = new Map<string, Promise<boolean>>();
const communityCacheDirty = new Set<string>();
const communityInvalidKey = (owner: string) => `${communityKey(owner)}.invalid`;
const communityPendingKey = (owner: string) => `${communityKey(owner)}.pending`;

export type CommunityVisibilityChange =
  | { kind: 'block'; target: { kind: 'post' | 'comment'; id: string } }
  | { kind: 'unblock'; id: string };

export async function readCommunityVisibilityChange(
  owner: string,
): Promise<CommunityVisibilityChange | null> {
  const raw = await AsyncStorage.getItem(communityPendingKey(owner));
  if (!raw) return null;

  const change = JSON.parse(raw) as CommunityVisibilityChange;

  if (change?.kind === 'unblock' && typeof change.id === 'string') {
    return change;
  }

  if (
    change?.kind === 'block' &&
    ['post', 'comment'].includes(change.target?.kind) &&
    typeof change.target?.id === 'string'
  ) {
    return change;
  }

  throw new Error('invalid_community_visibility_change');
}

export async function rememberCommunityVisibilityChange(
  owner: string,
  change: CommunityVisibilityChange,
) {
  await withPrivateWriteLock(owner, async () => {
    const existing = await readCommunityVisibilityChange(owner);

    if (existing && JSON.stringify(existing) !== JSON.stringify(change)) {
      throw new Error('community_change_pending');
    }

    await AsyncStorage.setItem(
      communityPendingKey(owner),
      JSON.stringify(change),
    );
  });

  await prepareCommunityCacheChange(owner);
}

export async function finishCommunityVisibilityChange(
  owner: string,
  change: CommunityVisibilityChange,
) {
  communityCacheVersions.set(owner, communityCacheVersion(owner) + 1);

  await withPrivateWriteLock(owner, async () => {
    const existing = await readCommunityVisibilityChange(owner);

    if (!existing || JSON.stringify(existing) !== JSON.stringify(change)) {
      throw new Error('community_change_changed');
    }

    // Keep the pending intent until the old cache has been removed.
    await AsyncStorage.removeItem(communityKey(owner));
    await AsyncStorage.removeItem(communityInvalidKey(owner));
    await AsyncStorage.removeItem(communityPendingKey(owner));
    communityCacheDirty.delete(owner);
  });
}
export function communityCacheVersion(owner?: string) { return communityCacheVersions.get(owner ?? 'guest') ?? 0; }

/** Persist the safety marker before a visibility-changing RPC can be accepted. */
export async function prepareCommunityCacheChange(owner: string) {
  communityCacheVersions.set(owner, communityCacheVersion(owner) + 1);
  communityCacheDirty.add(owner);
  await withPrivateWriteLock(owner, () => AsyncStorage.setItem(communityInvalidKey(owner), '1'));
}
async function recoverCommunityCache(owner: string): Promise<boolean> {
  const existing = communityCacheInvalidations.get(owner);
  if (existing) return existing;
  const version = communityCacheVersion(owner);
  const pending = withPrivateWriteLock(owner, async () => {
  if (await readCommunityVisibilityChange(owner)) return false;
    // Refresh the durable marker after confirmation as well: a concurrent
    // successful pre-block read may have replaced the earlier cache.
    await AsyncStorage.setItem(communityInvalidKey(owner), '1');
    await AsyncStorage.removeItem(communityKey(owner));
    if (version === communityCacheVersion(owner)) {
      await AsyncStorage.removeItem(communityInvalidKey(owner));
      communityCacheDirty.delete(owner);
    }
    return true;
  }).catch(() => false);
  communityCacheInvalidations.set(owner, pending);
  try { return await pending; }
  finally { if (communityCacheInvalidations.get(owner) === pending) communityCacheInvalidations.delete(owner); }
}
export async function invalidateCommunityCache(owner: string) {
  communityCacheVersions.set(owner, communityCacheVersion(owner) + 1);
  communityCacheDirty.add(owner);
  return recoverCommunityCache(owner);
}

export async function readCommunityCache<TPost>(userId?: string) {
  const version = communityCacheVersion(userId);
  if (userId) {
  if (await readCommunityVisibilityChange(userId)) return null;

  let unsafe = communityCacheDirty.has(userId);
    try { unsafe = Boolean(await AsyncStorage.getItem(communityInvalidKey(userId))) || unsafe; }
    catch { return null; }
    if (unsafe) { communityCacheDirty.add(userId); await recoverCommunityCache(userId); return null; }
  }
  const data = await readEnvelope<OfflineCommunityCache<TPost>>(communityKey(userId));
  return version === communityCacheVersion(userId) && !(userId && communityCacheDirty.has(userId)) ? data : null;
}

export function writeCommunityCache<TPost>(userId: string | undefined, data: OfflineCommunityCache<TPost>, version = communityCacheVersion(userId)) {
  const safeData = userId ? data : {
    ...data,
    posts: data.posts.map((post) => typeof post === 'object' && post !== null ? { ...post, user_id: null } : post),
    likedIds: [], savedIds: [], anonymousOwnedIds: [],
  };
  return userId ? withPrivateWriteLock(userId, async () => {
  if (await readCommunityVisibilityChange(userId)) return;
  if (version !== communityCacheVersion(userId)) return;
    await writeEnvelope(communityKey(userId), safeData);
    // Only an authoritative, current-generation read may replace invalidated data.
    if (version === communityCacheVersion(userId)) {
      await AsyncStorage.removeItem(communityInvalidKey(userId));
      communityCacheDirty.delete(userId);
    }
  }) : writeEnvelope(communityKey(userId), safeData);
}

export function readOfflineQueue(userId: string): Promise<OfflineQueueItem[]> {
  return readEnvelope<OfflineQueueItem[]>(privateKey(userId, 'queue')).then((items) =>
    Array.isArray(items) ? items : [],
  );
}

export function enqueueOfflineWrite(item: OfflineQueueItem): Promise<void> {
  return withQueueLock(item.userId, async () => {
    const items = await readOfflineQueue(item.userId);
    const duplicateIndex = items.findIndex((existing) => {
      if (existing.kind !== item.kind) return false;
      if (item.kind === 'daily_checkin' && existing.kind === 'daily_checkin') {
        return existing.payload.date === item.payload.date;
      }
      if (item.kind === 'journal_create' && existing.kind === 'journal_create') {
        return existing.payload.entry.id === item.payload.entry.id;
      }
      if (item.kind === 'mind_reset_complete') return existing.id === item.id;
      return false;
    });
    if (duplicateIndex >= 0) {
      const original = items[duplicateIndex];
      items[duplicateIndex] = item.kind === 'daily_checkin' && original.kind === 'daily_checkin'
        ? { ...item, analytics: original.analytics ?? null }
        : item;
    }
    else items.push(item);
    await writeEnvelope(privateKey(item.userId, 'queue'), items);
  });
}

export function removeOfflineQueueItem(userId: string, itemId: string): Promise<void> {
  return withQueueLock(userId, async () => {
    const items = await readOfflineQueue(userId);
    await writeEnvelope(privateKey(userId, 'queue'), items.filter((item) => item.id !== itemId));
  });
}

export function markOfflineQueueItemFailed(userId: string, itemId: string, message: string): Promise<void> {
  return withQueueLock(userId, async () => {
    const items = await readOfflineQueue(userId);
    await writeEnvelope(
      privateKey(userId, 'queue'),
      items.map((item) => item.id === itemId ? { ...item, failedMessage: message } : item),
    );
  });
}

export async function markJournalEntrySynced(userId: string, entryId: string): Promise<void> {
  const entries = await readJournalCache(userId);
  if (!entries) return;
  await writeJournalCache(
    userId,
    entries.map((entry) => entry.id === entryId ? { ...entry, sync_status: undefined } : entry),
  );
}

export async function markJournalEntryFailed(userId: string, entryId: string): Promise<void> {
  const entries = await readJournalCache(userId);
  if (!entries) return;
  await writeJournalCache(
    userId,
    entries.map((entry) => entry.id === entryId ? { ...entry, sync_status: 'failed' } : entry),
  );
}

export async function clearPrivateOfflineData(userId: string): Promise<void> {
  communityCacheVersions.set(userId, communityCacheVersion(userId) + 1);
  const pendingQueueOperation = queueLocks.get(userId);
  if (pendingQueueOperation) await pendingQueueOperation.catch(() => undefined);
  const pendingPrivateWrite = privateWriteLocks.get(userId);
  if (pendingPrivateWrite) await pendingPrivateWrite.catch(() => undefined);
  queueLocks.delete(userId);
  privateWriteLocks.delete(userId);
  await AsyncStorage.multiRemove([
    privateKey(userId, 'dashboard'),
    privateKey(userId, 'journal'),
    privateKey(userId, 'community'),
    privateKey(userId, 'community_v2'),
    privateKey(userId, 'community_v3'),
    communityInvalidKey(userId),
    privateKey(userId, 'queue'),
  ]);
  await AsyncStorage.removeItem(communityPendingKey(userId));
communityCacheDirty.delete(userId);
  emitOfflineSync({ userId, kind: 'all', status: 'cleared' });
}
