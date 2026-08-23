import { supabase } from './supabase';
import {
  allowPrivateOfflineUser,
  blockPrivateOfflineUser,
  clearPrivateOfflineData,
  emitOfflineSync,
  markJournalEntryFailed,
  markJournalEntrySynced,
  markOfflineQueueItemFailed,
  readOfflineQueue,
  removeOfflineQueueItem,
  type OfflineDailyCheckInItem,
  type OfflineJournalEntry,
  type OfflineJournalCreateItem,
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

function assertDailyCheckIn(item: OfflineDailyCheckInItem) {
  const { date, moodValue, sleepHours } = item.payload;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid_checkin_date');
  if (!Number.isInteger(moodValue) || moodValue < 1 || moodValue > 4) throw new Error('invalid_mood');
  if (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 12) throw new Error('invalid_sleep');
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

function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

async function recomputeStreak(userId: string) {
  const result = await supabase
    .from('mood_logs')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (result.error) throw result.error;

  const dates = [...new Set((result.data ?? []).map((row) => String(row.date)))].sort().reverse();
  const lastActivityDate = dates[0] ?? null;
  let streakCount = 0;
  let expected = lastActivityDate;
  for (const date of dates) {
    if (!expected || date !== expected) break;
    streakCount += 1;
    expected = previousDate(expected);
  }

  const streak = await supabase
    .from('user_streaks')
    .upsert({
      user_id: userId,
      streak_count: streakCount,
      last_activity_date: lastActivityDate,
    }, { onConflict: 'user_id' });
  if (streak.error) throw streak.error;
}

export async function persistDailyCheckIn(item: OfflineDailyCheckInItem) {
  assertDailyCheckIn(item);
  const { date, moodValue, sleepHours } = item.payload;
  const mood = await supabase
    .from('mood_logs')
    .upsert({ user_id: item.userId, date, mood_value: moodValue }, { onConflict: 'user_id,date' });
  if (mood.error) throw mood.error;
  await saveManualSleep(item.userId, date, sleepHours);
  await recomputeStreak(item.userId);
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

async function processItem(item: OfflineQueueItem) {
  if (item.kind === 'daily_checkin') await persistDailyCheckIn(item);
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

export function syncOfflineQueue(userId: string) {
  if (activeUserId !== userId) return Promise.resolve();
  if (inFlight) return inFlight;
  const runGeneration = generation;
  const request = runQueue(userId, runGeneration).finally(() => {
    if (inFlight === request) inFlight = null;
  });
  inFlight = request;
  return request;
}

export async function pauseAndClearOfflineUser(userId: string) {
  blockPrivateOfflineUser(userId);
  if (activeUserId === userId) {
    activeUserId = null;
    generation += 1;
  }
  const running = inFlight;
  if (running) await running.catch(() => undefined);
  await clearPrivateOfflineData(userId);
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
