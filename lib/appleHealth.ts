import { Platform, TurboModuleRegistry } from 'react-native';

import { supabase } from './supabase';
import { markDashboardStale } from './dashboardFreshness';
import {
  createHealthSyncGuard,
  dayKeysBetween,
  invalidateHealthSyncs,
  isValidTimeZone,
  minutesByDay,
  reconcileMetric,
  reconcileSleep,
  sleepHoursByWakeDay,
  startOfDayIn,
  sumSlicesByDay,
  type Interval,
  type ReadOutcome,
} from './healthSyncCore';

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

export type AppleHealthCapability = 'available' | 'unsupported' | 'native_build_required';
export type AppleHealthAuthorization = 'ready' | 'request_required' | 'unknown';

export class AppleHealthError extends Error {
  constructor(
    public readonly code: 'unavailable' | 'permission_denied',
    message: string,
  ) {
    super(message);
    this.name = 'AppleHealthError';
  }
}

export type AppleHealthIntegration = {
  id: string;
  provider: 'apple_health';
  device_name: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
};

export type AppleHealthSyncResult = {
  metricsWritten: number;
  sleepWritten: number;
  syncedAt: string;
  /** False when every read came back empty: Apple does not reveal whether read access was granted. */
  readableData: boolean;
};

// Steps, recorded workouts and sleep only. Resting heart rate is out of scope;
// Apple Exercise Time is replaced by actual workout durations.
const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKWorkoutTypeIdentifier',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

const APPLE_HEALTH_PROVIDER = 'apple_health';
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;
let healthKitModule: HealthKitModule | null | undefined;
const activeSyncs = new Map<string, Promise<AppleHealthSyncResult>>();

function loadHealthKit(): HealthKitModule | null {
  if (Platform.OS !== 'ios') return null;
  if (healthKitModule !== undefined) return healthKitModule;

  try {
    // Avoid loading the Nitro package in Expo Go or an older binary that does
    // not contain it. Requiring it in those binaries would fail before the UI
    // could explain that a new development build is required.
    if (!TurboModuleRegistry.get('NitroModules')) {
      healthKitModule = null;
      return null;
    }
    healthKitModule = require('@kingstinct/react-native-healthkit') as HealthKitModule;
  } catch {
    healthKitModule = null;
  }

  return healthKitModule;
}

export function getAppleHealthCapability(): AppleHealthCapability {
  if (Platform.OS !== 'ios') return 'unsupported';
  const healthKit = loadHealthKit();
  if (!healthKit) return 'native_build_required';
  return healthKit.isHealthDataAvailable() ? 'available' : 'unsupported';
}

export async function getAppleHealthAuthorization(): Promise<AppleHealthAuthorization> {
  const healthKit = loadHealthKit();
  if (!healthKit || !healthKit.isHealthDataAvailable()) return 'unknown';

  const status = await healthKit.getRequestStatusForAuthorization({ toRead: READ_TYPES });
  if (status === healthKit.AuthorizationRequestStatus.unnecessary) return 'ready';
  if (status === healthKit.AuthorizationRequestStatus.shouldRequest) return 'request_required';
  return 'unknown';
}

export async function getAppleHealthIntegration(userId: string): Promise<AppleHealthIntegration | null> {
  const { data, error } = await supabase
    .from('user_integrations')
    .select('id,provider,device_name,connected_at,last_sync_at')
    .eq('user_id', userId)
    .eq('provider', APPLE_HEALTH_PROVIDER)
    .maybeSingle();

  if (error) throw error;
  return (data as AppleHealthIntegration | null) ?? null;
}

export async function connectAppleHealth(userId: string): Promise<AppleHealthSyncResult> {
  const healthKit = loadHealthKit();
  if (!healthKit || !healthKit.isHealthDataAvailable()) {
    throw new AppleHealthError('unavailable', 'Apple Health is unavailable.');
  }

  const guard = createHealthSyncGuard(userId, currentSessionUserId);
  // A completed request does not prove read access: Apple never reveals denied reads.
  const requestCompleted = await healthKit.requestAuthorization({ toRead: READ_TYPES });
  if (!requestCompleted) {
    throw new AppleHealthError('permission_denied', 'Apple Health authorization was not completed.');
  }
  await guard.assertCurrent();
  const { error } = await supabase.from('user_integrations').upsert(
    {
      user_id: userId,
      provider: APPLE_HEALTH_PROVIDER,
      access_token: null,
      refresh_token: null,
      device_name: 'Apple Health',
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );

  if (error) throw error;
  return syncAppleHealth(userId, 31);
}

export async function syncAppleHealth(userId: string, days = 7): Promise<AppleHealthSyncResult> {
  const existingSync = activeSyncs.get(userId);
  if (existingSync) return existingSync;

  const sync = performAppleHealthSync(userId, clampDays(days));
  activeSyncs.set(userId, sync);
  try {
    return await sync;
  } finally {
    if (activeSyncs.get(userId) === sync) activeSyncs.delete(userId);
  }
}

export async function syncAppleHealthIfConnected(
  userId: string,
  options: { force?: boolean; days?: number } = {},
): Promise<AppleHealthSyncResult | null> {
  if (getAppleHealthCapability() !== 'available') return null;

  const integration = await getAppleHealthIntegration(userId);
  if (!integration) return null;

  if (!options.force && integration.last_sync_at) {
    const elapsed = Date.now() - new Date(integration.last_sync_at).getTime();
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < AUTO_SYNC_INTERVAL_MS) return null;
  }

  return syncAppleHealth(userId, options.days ?? 7);
}

async function performAppleHealthSync(userId: string, days: number): Promise<AppleHealthSyncResult> {
  const guard = createHealthSyncGuard(userId, currentSessionUserId);
  const healthKit = loadHealthKit();
  if (!healthKit || !healthKit.isHealthDataAvailable()) {
    throw new AppleHealthError('unavailable', 'Apple Health is unavailable.');
  }

  const authorization = await getAppleHealthAuthorization();
  if (authorization !== 'ready') {
    throw new AppleHealthError('permission_denied', 'Apple Health authorization is not ready.');
  }

  const timeZone = await accountTimeZone(userId);
  const endMs = Date.now();
  const windowDays = dayKeysBetween(timeZone, endMs - (days - 1) * 86_400_000, endMs);
  const startDate = new Date(startOfDayIn(timeZone, windowDays[0]));
  const endDate = new Date(endMs);

  const [steps, workouts, sleep] = await Promise.all([
    readOutcome(() => queryStepSlices(healthKit, startDate, endDate).then((slices) => sumSlicesByDay(slices, timeZone))),
    readOutcome(() => queryWorkoutIntervals(healthKit, startDate, endDate).then((intervals) => minutesByDay(intervals, timeZone))),
    readOutcome(() => querySleepIntervals(healthKit, startDate, endDate).then((intervals) => sleepHoursByWakeDay(intervals, timeZone))),
  ]);

  // Imported workouts feed the existing active-minutes metric only (one scoring path, no duplicate credit).
  const metrics = [...reconcileMetric('steps', steps, windowDays), ...reconcileMetric('active_mins', workouts, windowDays)];
  const sleepRows = reconcileSleep(sleep, windowDays);
  const readableData = metrics.length > 0 || sleepRows.some((row) => row.hours > 0);

  // The server takes the owner from the session token; never upload under a different session.
  await guard.assertCurrent();
  const { data, error } = await supabase.rpc('upsert_apple_health_daily_data', {
    p_metrics: metrics,
    p_sleep: sleepRows,
  });
  if (error) throw error;
  markDashboardStale(userId);

  const syncedAt = new Date().toISOString();
  await guard.assertCurrent();
  const { error: integrationError } = await supabase
    .from('user_integrations')
    .update({ last_sync_at: syncedAt })
    .eq('user_id', userId)
    .eq('provider', APPLE_HEALTH_PROVIDER);
  if (integrationError) throw integrationError;

  const counts = (data ?? {}) as { metrics_written?: number; sleep_written?: number };
  return {
    metricsWritten: Number(counts.metrics_written ?? 0),
    sleepWritten: Number(counts.sleep_written ?? 0),
    syncedAt,
    readableData,
  };
}

/**
 * App-level disconnect: stops in-flight and future imports for this account and
 * removes the connection. It does not change iPhone permissions (Settings > Health).
 * Imported history is kept unless the member deletes their account.
 */
export async function disconnectAppleHealth(userId: string): Promise<void> {
  invalidateHealthSyncs();
  activeSyncs.delete(userId);
  const { error } = await supabase.from('user_integrations').delete()
    .eq('user_id', userId).eq('provider', APPLE_HEALTH_PROVIDER);
  if (error) throw error;
}

async function currentSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Canonical account calendar: the saved account timezone, falling back to the phone only when none is saved. */
async function accountTimeZone(userId: string): Promise<string> {
  const { data } = await supabase.from('user_profile').select('timezone').eq('user_id', userId).maybeSingle();
  const saved = (data as { timezone?: string | null } | null)?.timezone;
  if (isValidTimeZone(saved)) return saved;
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(device) ? device : 'UTC';
}

async function readOutcome(read: () => Promise<Map<string, number>>): Promise<ReadOutcome> {
  try {
    return { state: 'read', values: await read() };
  } catch {
    return { state: 'failed' };
  }
}

/** 15-minute step totals (HealthKit de-duplicates overlapping sources), re-bucketed into account days. */
async function queryStepSlices(healthKit: HealthKitModule, startDate: Date, endDate: Date) {
  const rows = await healthKit.queryStatisticsCollectionForQuantity(
    'HKQuantityTypeIdentifierStepCount',
    ['cumulativeSum'],
    startDate,
    { minute: 15 },
    { filter: { date: { startDate, endDate, strictStartDate: true, strictEndDate: false } }, unit: 'count' },
  );
  return rows.flatMap((row) => {
    const value = row.sumQuantity?.quantity;
    if (value == null || !Number.isFinite(value) || !row.startDate) return [];
    return [{ start: new Date(row.startDate).getTime(), value }];
  });
}

/** Recorded workouts as [start, start + recorded duration]; HealthKit's duration excludes pauses. */
async function queryWorkoutIntervals(healthKit: HealthKitModule, startDate: Date, endDate: Date): Promise<Interval[]> {
  const workouts = await healthKit.queryWorkoutSamples({
    limit: 0,
    ascending: true,
    filter: { date: { startDate, endDate, strictStartDate: false, strictEndDate: false } },
  });
  return workouts.flatMap((workout) => {
    const start = new Date(workout.startDate).getTime();
    const end = new Date(workout.endDate).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const quantity = Number(workout.duration?.quantity);
    const unit = String(workout.duration?.unit ?? 's');
    const seconds = unit === 'min' ? quantity * 60 : unit === 'hr' ? quantity * 3600 : quantity;
    const activeMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, end - start) : end - start;
    return [[start, start + activeMs] as Interval];
  });
}

async function querySleepIntervals(healthKit: HealthKitModule, startDate: Date, endDate: Date): Promise<Interval[]> {
  const queryStart = new Date(startDate.getTime() - 86_400_000);
  const samples = await healthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: 0,
    ascending: true,
    filter: { date: { startDate: queryStart, endDate, strictStartDate: false, strictEndDate: false } },
  });
  const asleepValues = new Set([1, 3, 4, 5]);
  return samples.flatMap((sample) => {
    if (!asleepValues.has(Number(sample.value))) return [];
    const start = new Date(sample.startDate).getTime();
    const end = new Date(sample.endDate).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [[start, end] as Interval] : [];
  });
}

function clampDays(days: number) {
  if (!Number.isFinite(days)) return 7;
  return Math.max(1, Math.min(31, Math.round(days)));
}
