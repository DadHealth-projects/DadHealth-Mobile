import { occurrenceHeader } from './analyticsOccurrence';
import { supabase } from './supabase';
import { clearHeldMindResets, readHeldMindResets, updateHeldMindResets } from './mindResetPendingStore';
import {
  allowPrivateOfflineUser,
  blockPrivateOfflineUser,
  clearPrivateOfflineData,
  emitOfflineSync,
  enqueueOfflineWrite,
  markJournalEntryFailed,
  markJournalEntrySynced,
  markOfflineQueueItemFailed,
  readOfflineQueue,
  removeOfflineQueueItem,
  type OfflineDailyCheckInItem,
  type OfflineJournalEntry,
  type OfflineJournalCreateItem,
  type OfflineMindResetItem,
  type OfflineQueueItem,
} from './offlineStorage';

const WEARABLE_SLEEP_SOURCES = new Set(['garmin', 'fitbit', 'apple_health', 'health_connect']);
const PERMANENT_SYNC_MESSAGE = 'This saved item could not be synced. Open it and try again.';

let activeUserId: string | null = null;
let generation = 0;
let inFlight: Promise<void> | null = null;

function errorDetails(error: unknown) {
  return typeof error === 'object' && error !== null
    ? error as { code?: string; message?: string; status?: number }
    : {};
}

export function isRetryableOfflineError(error: unknown) {
  const detail = errorDetails(error);
  const message = detail.message?.toLowerCase() ?? '';
  return detail.status === 0
    || (typeof detail.status === 'number' && detail.status >= 500)
    || ['network', 'fetch', 'timeout', 'connection', 'offline'].some((word) => message.includes(word));
}

export class PartialDailyCheckInSaveError extends Error {
  constructor(public readonly saveError: unknown) {
    super('checkin_saved_sleep_failed');
    this.name = 'PartialDailyCheckInSaveError';
  }
}

function assertDailyCheckIn(item: OfflineDailyCheckInItem) {
  const { date, moodValue, stressLevel, energyLevel, connectionLevel, sleepHours } = item.payload;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid_checkin_date');
  if (!Number.isInteger(moodValue) || moodValue < 1 || moodValue > 5) throw new Error('invalid_mood');
  if (stressLevel != null && (!Number.isInteger(stressLevel) || stressLevel < 1 || stressLevel > 5)) throw new Error('invalid_stress');
  if (energyLevel != null && (!Number.isInteger(energyLevel) || energyLevel < 1 || energyLevel > 5)) throw new Error('invalid_energy');
  if (connectionLevel != null && (!Number.isInteger(connectionLevel) || connectionLevel < 1 || connectionLevel > 5)) throw new Error('invalid_connection');
  if (sleepHours != null && (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 12)) throw new Error('invalid_sleep');
}

async function saveManualSleep(userId: string, date: string, hours: number) {
  const existing = await supabase
    .from('sleep_logs')
    .select('source')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (WEARABLE_SLEEP_SOURCES.has(existing.data?.source ?? '')) return;

  if (existing.data) {
    const updated = await supabase
      .from('sleep_logs')
      .update({ hours, source: 'manual' })
      .eq('user_id', userId)
      .eq('date', date)
      .eq('source', 'manual');
    if (updated.error) throw updated.error;
    return;
  }

  const inserted = await supabase
    .from('sleep_logs')
    .insert({ user_id: userId, date, hours, source: 'manual' });
  if (!inserted.error) return;
  if (inserted.error.code !== '23505') throw inserted.error;

  // A wearable or another device may have inserted the row after our read.
  // Re-read it and only update if it is still a manual row.
  const raced = await supabase
    .from('sleep_logs')
    .select('source')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (raced.error) throw raced.error;
  if (WEARABLE_SLEEP_SOURCES.has(raced.data?.source ?? '')) return;
  const updated = await supabase
    .from('sleep_logs')
    .update({ hours, source: 'manual' })
    .eq('user_id', userId)
    .eq('date', date)
    .eq('source', 'manual');
  if (updated.error) throw updated.error;
}

export async function persistDailyCheckIn(item: OfflineDailyCheckInItem) {
  assertDailyCheckIn(item);
  const { date, moodValue, stressLevel, energyLevel, connectionLevel, sleepHours } = item.payload;
  const moodPayload = {
    mood_value: moodValue,
    mood_scale_version: 1,
    ...(energyLevel == null ? {} : { energy_level: energyLevel }),
    ...(connectionLevel == null ? {} : { connection_level: connectionLevel }),
    ...(stressLevel == null ? {} : { stress_level: stressLevel }),
  };

  // Upsert would set omitted optional columns to NULL on conflict. Update only
  // supplied fields; insert when no same-day row exists.
  const existingMood = await supabase
    .from('mood_logs')
    .select('date')
    .eq('user_id', item.userId)
    .eq('date', date)
    .maybeSingle();
  if (existingMood.error) throw existingMood.error;

  if (existingMood.data) {
    const updated = await supabase
      .from('mood_logs')
      .update(moodPayload)
      .eq('user_id', item.userId)
      .eq('date', date)
      .setHeader('x-dadhealth-analytics', occurrenceHeader(item.analytics));
    if (updated.error) throw updated.error;
  } else {
    const inserted = await supabase
      .from('mood_logs')
      .insert({ user_id: item.userId, date, ...moodPayload })
      .setHeader('x-dadhealth-analytics', occurrenceHeader(item.analytics));
    if (inserted.error) {
      if (inserted.error.code !== '23505') throw inserted.error;
      // Another device may create today's row after the lookup. Retry as a
      // partial update so absent optional values remain unchanged.
      const racedUpdate = await supabase
        .from('mood_logs')
        .update(moodPayload)
        .eq('user_id', item.userId)
        .eq('date', date)
        .setHeader('x-dadhealth-analytics', occurrenceHeader(item.analytics));
      if (racedUpdate.error) throw racedUpdate.error;
    }
  }

  if (sleepHours != null) {
    try {
      await saveManualSleep(item.userId, date, sleepHours);
    } catch (error) {
      throw new PartialDailyCheckInSaveError(error);
    }
  }
}

export async function persistJournalEntry(item: OfflineJournalCreateItem) {
  const entry = item.payload.entry;
  if (!entry.id || !entry.content.trim() || entry.user_id !== item.userId) {
    throw new Error('invalid_journal_entry');
  }
  const result = await supabase.from('journal_entries').insert({
    id: entry.id,
    user_id: entry.user_id,
    content: entry.content,
    prompt: entry.prompt,
    mood_value: entry.mood_value,
    tag: entry.tag,
    created_at: entry.created_at,
  });
  if (!result.error) return;
  if (result.error.code !== '23505') throw result.error;

  const existing = await supabase
    .from('journal_entries')
    .select('id')
    .eq('id', entry.id)
    .eq('user_id', item.userId)
    .maybeSingle();
  if (existing.error || !existing.data) throw result.error;
}

/** The backend accepts completions up to 8 days old (complete_mind_reset). */
export const MIND_RESET_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

/** A completion the server cannot accept yet (device clock ahead); keep it and try again later. */
export class MindResetRetryLaterError extends Error {
  constructor() {
    super('mind_reset_retry_later');
    this.name = 'MindResetRetryLaterError';
  }
}

export function createMindResetQueueItem(
  userId: string,
  id: string,
  activeSeconds: number,
  completedAt = new Date().toISOString(),
): OfflineMindResetItem {
  return { id, userId, kind: 'mind_reset_complete', createdAt: completedAt, payload: { completedAt, activeSeconds } };
}

export async function persistMindReset(item: OfflineMindResetItem, now = Date.now()) {
  const { completedAt, activeSeconds } = item.payload;
  const completedMs = Date.parse(completedAt);
  if (!item.id || !Number.isFinite(completedMs) || !Number.isInteger(activeSeconds) || activeSeconds < 60 || activeSeconds > 300) {
    throw new Error('invalid_mind_reset');
  }
  // Too old for the server to accept: drop it honestly instead of retrying forever.
  if (now - completedMs > MIND_RESET_MAX_AGE_MS) throw new Error('mind_reset_expired');
  const result = await supabase.rpc('complete_mind_reset', {
    p_id: item.id,
    p_completed_at: completedAt,
    p_active_seconds: activeSeconds,
  });
  if (!result.error) return;
  // The only other 22023 cause with a valid payload is a completion time ahead of the server clock.
  if (result.error.code === '22023' && completedMs > now - MIND_RESET_MAX_AGE_MS) throw new MindResetRetryLaterError();
  throw result.error;
}

async function processItem(item: OfflineQueueItem) {
  if (item.kind === 'daily_checkin') await persistDailyCheckIn(item);
  else if (item.kind === 'mind_reset_complete') await persistMindReset(item);
  else await persistJournalEntry(item);
}

async function finishItem(item: OfflineQueueItem) {
  await removeOfflineQueueItem(item.userId, item.id);
  if (item.kind === 'journal_create') {
    await markJournalEntrySynced(item.userId, item.payload.entry.id);
  }
  emitOfflineSync({ userId: item.userId, kind: item.kind, status: 'synced' });
}

async function failItem(item: OfflineQueueItem) {
  await markOfflineQueueItemFailed(item.userId, item.id, PERMANENT_SYNC_MESSAGE);
  if (item.kind === 'journal_create') {
    await markJournalEntryFailed(item.userId, item.payload.entry.id);
  }
  emitOfflineSync({
    userId: item.userId,
    kind: item.kind,
    status: 'failed',
    message: PERMANENT_SYNC_MESSAGE,
  });
}

async function runQueue(userId: string, runGeneration: number) {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.data.session?.user.id !== userId) return;

  const items = await readOfflineQueue(userId);
  for (const item of items) {
    if (activeUserId !== userId || generation !== runGeneration) return;
    if (item.failedMessage) continue;
    try {
      await processItem(item);
      if (activeUserId !== userId || generation !== runGeneration) return;
      await finishItem(item);
    } catch (error) {
      if (activeUserId !== userId || generation !== runGeneration) return;
      if (isRetryableOfflineError(error)) return;
      // Leave it queued for the next sync without blocking later items.
      if (error instanceof MindResetRetryLaterError) continue;
      await failItem(item);
    }
  }
}

export function setOfflineSyncUser(userId: string | null) {
  if (activeUserId === userId) return;
  activeUserId = userId;
  generation += 1;
  if (userId) allowPrivateOfflineUser(userId);
}

// ── Mind Reset completions the offline queue could not store ────────────────
// If the durable queue write fails, the completion is held in memory AND in a second durable
// store (device keychain, survives restart). Every sync merges both and retries: back into the
// queue, otherwise straight to the server. The id is the server's idempotent session id, so no
// retry can credit twice. Only the signed-in owner's items are sent; sign-out drops them.
// Never reported as saved until the server confirms.
export const MIND_RESET_SAVE_FAILED = 'We couldn’t save this Mind Reset yet. We’ll keep trying while Dad Health is open.';
export const MIND_RESET_SAVE_DELAYED = 'We couldn’t send this Mind Reset yet. It’s kept on this phone and we’ll try again.';
const pendingMindResets = new Map<string, OfflineMindResetItem[]>();

function mergeHeld(...lists: OfflineMindResetItem[][]) {
  const byId = new Map<string, OfflineMindResetItem>();
  for (const list of lists) for (const item of list) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()];
}

/** Holds a completion the queue could not store. Resolves true only when THIS item is also saved durably. */
export async function holdPendingMindReset(item: OfflineMindResetItem): Promise<boolean> {
  pendingMindResets.set(item.userId, mergeHeld(pendingMindResets.get(item.userId) ?? [], [item]));
  const result = await updateHeldMindResets(item.userId, (stored) => mergeHeld(stored, [item]));
  return result.ok && result.storedIds.has(item.id);
}

export function pendingMindResetCount(userId: string) {
  return pendingMindResets.get(userId)?.length ?? 0;
}

async function recoverPendingMindResets(userId: string, runGeneration: number) {
  const durable = await readHeldMindResets(userId);
  const held = mergeHeld(pendingMindResets.get(userId) ?? [], durable.items);
  if (!held.length) {
    // An unreadable keychain is not "nothing held": say so instead of staying silent.
    if (!durable.ok) emitOfflineSync({ userId, kind: 'mind_reset_complete', status: 'failed', message: MIND_RESET_SAVE_FAILED });
    return;
  }
  pendingMindResets.set(userId, held);
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.data.session?.user.id !== userId) return;
  const finished = new Set<string>();
  for (const item of held) {
    if (activeUserId !== userId || generation !== runGeneration) break;
    try {
      await enqueueOfflineWrite(item);
      finished.add(item.id); // durable in the queue again: the normal queue below sends it
    } catch {
      try {
        await persistMindReset(item);
        finished.add(item.id);
        emitOfflineSync({ userId, kind: 'mind_reset_complete', status: 'synced' });
      } catch (error) {
        // Invalid or too old for the server: it can never be accepted, so stop holding it.
        if (error instanceof Error && (error.message === 'invalid_mind_reset' || error.message === 'mind_reset_expired')) finished.add(item.id);
      }
    }
  }
  const remaining = (pendingMindResets.get(userId) ?? []).filter((item) => !finished.has(item.id));
  if (remaining.length) pendingMindResets.set(userId, remaining); else pendingMindResets.delete(userId);
  // Remove only what was finished; items held meanwhile by another call are kept.
  const update = await updateHeldMindResets(userId, (stored) => mergeHeld(stored, remaining).filter((item) => !finished.has(item.id)));
  if (remaining.length) {
    const allDurable = update.ok && remaining.every((item) => update.storedIds.has(item.id));
    emitOfflineSync({ userId, kind: 'mind_reset_complete', status: 'failed',
      message: allDurable ? MIND_RESET_SAVE_DELAYED : MIND_RESET_SAVE_FAILED });
  }
}

export function syncOfflineQueue(userId: string) {
  if (activeUserId !== userId) return Promise.resolve();
  if (inFlight) return inFlight;
  const runGeneration = generation;
  const request = recoverPendingMindResets(userId, runGeneration)
    .catch(() => undefined)
    .then(() => runQueue(userId, runGeneration)).finally(() => {
    if (inFlight === request) inFlight = null;
  });
  inFlight = request;
  return request;
}

export async function pauseAndClearOfflineUser(userId: string) {
  blockPrivateOfflineUser(userId);
  pendingMindResets.delete(userId);
  if (activeUserId === userId) {
    activeUserId = null;
    generation += 1;
  }
  const running = inFlight;
  if (running) await running.catch(() => undefined);
  // Every step runs; a failed keychain clear is reported afterwards, never hidden as success.
  let keychainError: unknown = null;
  try { await clearHeldMindResets(userId); } catch (error) { keychainError = error; }
  await clearPrivateOfflineData(userId);
  if (keychainError) throw keychainError;
}

export function createJournalQueueItem(
  userId: string,
  entry: OfflineJournalEntry,
  id: string,
): OfflineJournalCreateItem {
  return {
    id,
    userId,
    kind: 'journal_create',
    createdAt: new Date().toISOString(),
    payload: { entry },
  };
}
