import * as Crypto from 'expo-crypto';
import { enqueueOfflineWrite } from './offlineStorage';
import { createMindResetQueueItem, syncOfflineQueue } from './offlineSync';

/**
 * Saves a finished Mind Reset (60–300 active seconds) for scoring. It is queued
 * first so a completion made offline or during a failed request is replayed
 * later; the queue id doubles as the server's idempotent session id.
 */
export async function recordMindResetCompletion(userId: string, activeSeconds: number): Promise<void> {
  try {
    await enqueueOfflineWrite(createMindResetQueueItem(userId, Crypto.randomUUID(), activeSeconds));
    await syncOfflineQueue(userId);
  } catch {
    // Local queue failures must not interrupt the session UI; the score stays unchanged.
  }
}
