import * as Crypto from 'expo-crypto';
import { enqueueOfflineWrite } from './offlineStorage';
import { createMindResetQueueItem, holdPendingMindReset, syncOfflineQueue } from './offlineSync';

/**
 * Saves a finished Mind Reset (60–300 active seconds) for scoring. It is queued
 * first so a completion made offline or during a failed request is replayed
 * later; the queue id doubles as the server's idempotent session id.
 * If the device cannot store it, it is held and retried (durable queue, then the
 * server) on every sync instead of being dropped; a failure is reported honestly.
 */
export async function recordMindResetCompletion(userId: string, activeSeconds: number): Promise<void> {
  const item = createMindResetQueueItem(userId, Crypto.randomUUID(), activeSeconds);
  try {
    await enqueueOfflineWrite(item);
  } catch {
    holdPendingMindReset(item);
  }
  try {
    await syncOfflineQueue(userId);
  } catch {
    // Sync failures keep the completion queued or held for the next sync; the UI is not interrupted.
  }
}
