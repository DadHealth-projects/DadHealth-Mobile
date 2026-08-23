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
  payload: {
    date: string;
    moodValue: number;
    sleepHours: number;
  };
};

export type OfflineJournalCreateItem = QueueItemBase & {
  kind: 'journal_create';
  payload: {
    entry: OfflineJournalEntry;
  };
};

export type OfflineQueueItem = OfflineDailyCheckInItem | OfflineJournalCreateItem;

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

function privateKey(userId: string, name: 'dashboard' | 'journal' | 'community' | 'queue') {
  return `${PREFIX}.private.${userId}.${name}`;
}

function communityKey(userId?: string) {
  return userId ? privateKey(userId, 'community') : `${PREFIX}.public.community`;
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

export function readCommunityCache<TPost>(userId?: string) {
  return readEnvelope<OfflineCommunityCache<TPost>>(communityKey(userId));
}

export function writeCommunityCache<TPost>(userId: string | undefined, data: OfflineCommunityCache<TPost>) {
  const safeData = userId
    ? data
    : {
        ...data,
        posts: data.posts.map((post) => typeof post === 'object' && post !== null
          ? { ...post, user_id: null }
          : post),
        likedIds: [],
        savedIds: [],
        anonymousOwnedIds: [],
      };
  return userId
    ? withPrivateWriteLock(userId, () => writeEnvelope(communityKey(userId), safeData))
    : writeEnvelope(communityKey(userId), safeData);
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
      return false;
    });
    if (duplicateIndex >= 0) items[duplicateIndex] = item;
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
    privateKey(userId, 'queue'),
  ]);
  emitOfflineSync({ userId, kind: 'all', status: 'cleared' });
}
