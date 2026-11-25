import AsyncStorage from '@react-native-async-storage/async-storage';

import { EXTENDED_WINDOW_DAYS, refreshWindowDays } from './healthSyncCore';

/** Per account and provider, so one account's schedule never affects another's. */
const key = (provider: string, userId: string) => `dadhealth.health.extended.v1.${provider}.${userId}`;

export async function nextRefreshDays(provider: string, userId: string, now = Date.now()): Promise<number> {
  const stored = await AsyncStorage.getItem(key(provider, userId)).catch(() => null);
  const parsed = stored == null ? null : Number(stored);
  return refreshWindowDays(parsed != null && Number.isFinite(parsed) ? parsed : null, now);
}

/** Recorded only after a successful extended sync, so a failed one is retried next time. */
export async function markRefreshCompleted(provider: string, userId: string, days: number, now = Date.now()): Promise<void> {
  if (days < EXTENDED_WINDOW_DAYS) return;
  await AsyncStorage.setItem(key(provider, userId), String(now)).catch(() => undefined);
}
