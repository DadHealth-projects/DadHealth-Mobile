import { Platform, TurboModuleRegistry } from 'react-native';

import { supabase } from './supabase';

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
};

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierRestingHeartRate',
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

  const requestCompleted = await healthKit.requestAuthorization({ toRead: READ_TYPES });
  if (!requestCompleted) {
    throw new AppleHealthError('permission_denied', 'Apple Health authorization was not completed.');
  }
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
  const healthKit = loadHealthKit();
  if (!healthKit || !healthKit.isHealthDataAvailable()) {
    throw new AppleHealthError('unavailable', 'Apple Health is unavailable.');
  }

  const authorization = await getAppleHealthAuthorization();
  if (authorization !== 'ready') {
    throw new AppleHealthError('permission_denied', 'Apple Health authorization is not ready.');
  }

  const endDate = new Date();
  const startDate = startOfLocalDay(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const [steps, activeMinutes, restingHeartRate, sleep] = await Promise.all([
    queryDailyQuantity(
      healthKit,
      'HKQuantityTypeIdentifierStepCount',
      'cumulativeSum',
      'count',
      'steps',
      startDate,
      endDate,
    ),
    queryDailyQuantity(
      healthKit,
      'HKQuantityTypeIdentifierAppleExerciseTime',
      'cumulativeSum',
      'min',
      'active_mins',
      startDate,
      endDate,
    ),
    queryDailyQuantity(
      healthKit,
      'HKQuantityTypeIdentifierRestingHeartRate',
      'mostRecent',
      'count/min',
      'resting_hr',
      startDate,
      endDate,
    ),
    queryDailySleep(healthKit, startDate, endDate),
  ]);

  const metrics = [...steps, ...activeMinutes, ...restingHeartRate];
  const { data, error } = await supabase.rpc('upsert_apple_health_daily_data', {
    p_metrics: metrics,
    p_sleep: sleep,
  });
  if (error) throw error;

  const syncedAt = new Date().toISOString();
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
  };
}

async function queryDailyQuantity(
  healthKit: HealthKitModule,
  identifier:
    | 'HKQuantityTypeIdentifierStepCount'
    | 'HKQuantityTypeIdentifierAppleExerciseTime'
    | 'HKQuantityTypeIdentifierRestingHeartRate',
  statistic: 'cumulativeSum' | 'mostRecent',
  unit: 'count' | 'min' | 'count/min',
  metricType: 'steps' | 'active_mins' | 'resting_hr',
  startDate: Date,
  endDate: Date,
) {
  const rows = await healthKit.queryStatisticsCollectionForQuantity(
    identifier,
    [statistic],
    startDate,
    { day: 1 },
    {
      filter: { date: { startDate, endDate, strictStartDate: true, strictEndDate: false } },
      unit,
    },
  );

  return rows.flatMap((row) => {
    const quantity = statistic === 'cumulativeSum'
      ? row.sumQuantity?.quantity
      : row.mostRecentQuantity?.quantity;
    if (quantity == null || !Number.isFinite(quantity) || quantity <= 0 || !row.startDate) return [];

    const value = metricType === 'resting_hr'
      ? Math.round(quantity * 10) / 10
      : Math.round(quantity);
    return [{
      metric_type: metricType,
      value,
      recorded_at: `${localDateKey(new Date(row.startDate))}T00:00:00.000Z`,
    }];
  });
}

async function queryDailySleep(healthKit: HealthKitModule, startDate: Date, endDate: Date) {
  const queryStart = new Date(startDate);
  queryStart.setDate(queryStart.getDate() - 1);
  const samples = await healthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: 0,
    ascending: true,
    filter: { date: { startDate: queryStart, endDate, strictStartDate: false, strictEndDate: false } },
  });

  const asleepValues = new Set([1, 3, 4, 5]);
  const intervalsByDate = new Map<string, Array<[number, number]>>();

  for (const sample of samples) {
    if (!asleepValues.has(Number(sample.value))) continue;
    const start = new Date(sample.startDate).getTime();
    const end = new Date(sample.endDate).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const date = localDateKey(new Date(end));
    const intervals = intervalsByDate.get(date) ?? [];
    intervals.push([start, end]);
    intervalsByDate.set(date, intervals);
  }

  return Array.from(intervalsByDate.entries()).flatMap(([date, intervals]) => {
    if (date < localDateKey(startDate) || date > localDateKey(endDate)) return [];
    const hours = mergeIntervalHours(intervals);
    return hours > 0 && hours <= 24 ? [{ date, hours }] : [];
  });
}

function mergeIntervalHours(intervals: Array<[number, number]>) {
  const sorted = [...intervals].sort((left, right) => left[0] - right[0]);
  let totalMs = 0;
  let currentStart: number | null = null;
  let currentEnd: number | null = null;

  for (const [start, end] of sorted) {
    if (currentStart == null || currentEnd == null) {
      currentStart = start;
      currentEnd = end;
    } else if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      totalMs += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }

  if (currentStart != null && currentEnd != null) totalMs += currentEnd - currentStart;
  return Math.round((totalMs / 3_600_000) * 10) / 10;
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampDays(days: number) {
  if (!Number.isFinite(days)) return 7;
  return Math.max(1, Math.min(31, Math.round(days)));
}
