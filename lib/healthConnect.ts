import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

import { supabase } from './supabase';

type HealthConnectModule = typeof import('react-native-health-connect');
type HealthConnectPermission = {
  accessType: 'read';
  recordType: 'Steps' | 'ExerciseSession' | 'RestingHeartRate' | 'SleepSession';
};

export type HealthConnectCapability =
  | 'available'
  | 'unsupported'
  | 'unavailable'
  | 'provider_update_required'
  | 'native_build_required';
export type HealthConnectAuthorization = 'ready' | 'partial' | 'request_required' | 'unknown';

export class HealthConnectError extends Error {
  constructor(
    public readonly code: 'unavailable' | 'provider_update_required' | 'permission_denied',
    message: string,
  ) {
    super(message);
    this.name = 'HealthConnectError';
  }
}

export type HealthConnectIntegration = {
  id: string;
  provider: 'health_connect';
  device_name: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
};

export type HealthConnectSyncResult = {
  metricsWritten: number;
  sleepWritten: number;
  syncedAt: string;
};

const READ_PERMISSIONS: HealthConnectPermission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
];
const HEALTH_CONNECT_PROVIDER = 'health_connect';
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const MAX_PAGE_SIZE = 1000;
const ASLEEP_STAGE_TYPES = new Set([2, 4, 5, 6]);

let healthConnectModule: HealthConnectModule | null | undefined;
const activeSyncs = new Map<string, Promise<HealthConnectSyncResult>>();

function loadHealthConnect(): HealthConnectModule | null {
  if (Platform.OS !== 'android') return null;
  if (healthConnectModule !== undefined) return healthConnectModule;

  try {
    const nativeModule = NativeModules.HealthConnect ?? TurboModuleRegistry.get('HealthConnect');
    if (!nativeModule) {
      healthConnectModule = null;
      return null;
    }
    healthConnectModule = require('react-native-health-connect') as HealthConnectModule;
  } catch {
    healthConnectModule = null;
  }

  return healthConnectModule;
}

export async function getHealthConnectCapability(): Promise<HealthConnectCapability> {
  if (Platform.OS !== 'android') return 'unsupported';
  const healthConnect = loadHealthConnect();
  if (!healthConnect) return 'native_build_required';

  try {
    const status = await healthConnect.getSdkStatus();
    if (status === healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === healthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'provider_update_required';
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function getHealthConnectAuthorization(): Promise<HealthConnectAuthorization> {
  const healthConnect = await initializeAvailableHealthConnect();
  const granted = await healthConnect.getGrantedPermissions();
  const grantedTypes = getGrantedRecordTypes(granted);
  if (grantedTypes.size === READ_PERMISSIONS.length) return 'ready';
  if (grantedTypes.size > 0) return 'partial';
  return 'request_required';
}

export async function getHealthConnectIntegration(userId: string): Promise<HealthConnectIntegration | null> {
  if (Platform.OS !== 'android') return null;
  const { data, error } = await supabase
    .from('user_integrations')
    .select('id,provider,device_name,connected_at,last_sync_at')
    .eq('user_id', userId)
    .eq('provider', HEALTH_CONNECT_PROVIDER)
    .maybeSingle();

  if (error) throw error;
  return (data as HealthConnectIntegration | null) ?? null;
}

export async function connectHealthConnect(userId: string): Promise<HealthConnectSyncResult> {
  const healthConnect = await initializeAvailableHealthConnect();
  const granted = await healthConnect.requestPermission(READ_PERMISSIONS);
  if (getGrantedRecordTypes(granted).size === 0) {
    throw new HealthConnectError('permission_denied', 'Health Connect access was not enabled.');
  }

  const connectedAt = new Date().toISOString();
  const { error } = await supabase.from('user_integrations').upsert(
    {
      user_id: userId,
      provider: HEALTH_CONNECT_PROVIDER,
      access_token: null,
      refresh_token: null,
      device_name: 'Health Connect',
      connected_at: connectedAt,
    },
    { onConflict: 'user_id,provider' },
  );

  if (error) throw error;
  return syncHealthConnect(userId, 30);
}

export async function syncHealthConnect(userId: string, days = 7): Promise<HealthConnectSyncResult> {
  const existingSync = activeSyncs.get(userId);
  if (existingSync) return existingSync;

  const sync = performHealthConnectSync(userId, clampDays(days));
  activeSyncs.set(userId, sync);
  try {
    return await sync;
  } finally {
    if (activeSyncs.get(userId) === sync) activeSyncs.delete(userId);
  }
}

export async function syncHealthConnectIfConnected(
  userId: string,
  options: { force?: boolean; days?: number } = {},
): Promise<HealthConnectSyncResult | null> {
  if (await getHealthConnectCapability() !== 'available') return null;

  const integration = await getHealthConnectIntegration(userId);
  if (!integration) return null;

  if (!options.force && integration.last_sync_at) {
    const elapsed = Date.now() - new Date(integration.last_sync_at).getTime();
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < AUTO_SYNC_INTERVAL_MS) return null;
  }

  return syncHealthConnect(userId, options.days ?? 7);
}

export function openHealthConnectSettings() {
  const healthConnect = loadHealthConnect();
  if (!healthConnect) return;
  healthConnect.openHealthConnectSettings();
}

async function performHealthConnectSync(userId: string, days: number): Promise<HealthConnectSyncResult> {
  const healthConnect = await initializeAvailableHealthConnect();
  const granted = getGrantedRecordTypes(await healthConnect.getGrantedPermissions());
  if (granted.size === 0) {
    throw new HealthConnectError('permission_denied', 'Health Connect access is not enabled.');
  }

  const endDate = new Date();
  const startDate = startOfLocalDay(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const [steps, activeMinutes, restingHeartRate, sleep] = await Promise.all([
    granted.has('Steps')
      ? queryDailySteps(healthConnect, startDate, endDate)
      : Promise.resolve([]),
    granted.has('ExerciseSession')
      ? queryDailyExerciseMinutes(healthConnect, startDate, endDate)
      : Promise.resolve([]),
    granted.has('RestingHeartRate')
      ? queryDailyRestingHeartRate(healthConnect, startDate, endDate)
      : Promise.resolve([]),
    granted.has('SleepSession')
      ? queryDailySleep(healthConnect, startDate, endDate)
      : Promise.resolve([]),
  ]);

  const { data, error } = await supabase.rpc('upsert_health_connect_daily_data', {
    p_metrics: [...steps, ...activeMinutes, ...restingHeartRate],
    p_sleep: sleep,
  });
  if (error) throw error;

  const syncedAt = new Date().toISOString();
  const { error: integrationError } = await supabase
    .from('user_integrations')
    .update({ last_sync_at: syncedAt })
    .eq('user_id', userId)
    .eq('provider', HEALTH_CONNECT_PROVIDER);
  if (integrationError) throw integrationError;

  const counts = (data ?? {}) as { metrics_written?: number; sleep_written?: number };
  return {
    metricsWritten: Number(counts.metrics_written ?? 0),
    sleepWritten: Number(counts.sleep_written ?? 0),
    syncedAt,
  };
}

async function queryDailySteps(
  healthConnect: HealthConnectModule,
  startDate: Date,
  endDate: Date,
) {
  const groups = await healthConnect.aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: dateRange(startDate, endDate),
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  });

  return groups.flatMap((group) => {
    const value = Math.round(Number(group.result.COUNT_TOTAL ?? 0));
    return value > 0 ? [metricRow('steps', value, group.startTime)] : [];
  });
}

async function queryDailyExerciseMinutes(
  healthConnect: HealthConnectModule,
  startDate: Date,
  endDate: Date,
) {
  const groups = await healthConnect.aggregateGroupByPeriod({
    recordType: 'ExerciseSession',
    timeRangeFilter: dateRange(startDate, endDate),
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  });

  return groups.flatMap((group) => {
    const seconds = Number(group.result.EXERCISE_DURATION_TOTAL?.inSeconds ?? 0);
    const value = Math.round(seconds / 60);
    return value > 0 ? [metricRow('active_mins', value, group.startTime)] : [];
  });
}

async function queryDailyRestingHeartRate(
  healthConnect: HealthConnectModule,
  startDate: Date,
  endDate: Date,
) {
  const records = await readAllRecords(healthConnect, 'RestingHeartRate', startDate, endDate);
  const latestByDate = new Map<string, { time: number; value: number }>();

  for (const record of records) {
    const time = new Date(record.time).getTime();
    const value = Number(record.beatsPerMinute);
    if (!Number.isFinite(time) || !Number.isFinite(value) || value <= 0) continue;
    const date = localDateKey(new Date(time));
    const existing = latestByDate.get(date);
    if (!existing || time > existing.time) latestByDate.set(date, { time, value });
  }

  return Array.from(latestByDate.entries()).map(([date, record]) =>
    metricRow('resting_hr', Math.round(record.value * 10) / 10, date),
  );
}

async function queryDailySleep(
  healthConnect: HealthConnectModule,
  startDate: Date,
  endDate: Date,
) {
  const queryStart = new Date(startDate);
  queryStart.setDate(queryStart.getDate() - 1);
  const records = await readAllRecords(healthConnect, 'SleepSession', queryStart, endDate);
  const intervalsByDate = new Map<string, Array<[number, number]>>();

  for (const record of records) {
    const recordedStages = record.stages ?? [];
    const asleepStages = recordedStages.filter((stage) => ASLEEP_STAGE_TYPES.has(Number(stage.stage)));
    const intervals = recordedStages.length > 0
      ? asleepStages.map((stage) => [new Date(stage.startTime).getTime(), new Date(stage.endTime).getTime()] as [number, number])
      : [[new Date(record.startTime).getTime(), new Date(record.endTime).getTime()] as [number, number]];

    for (const [start, end] of intervals) {
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const date = localDateKey(new Date(end));
      const dayIntervals = intervalsByDate.get(date) ?? [];
      dayIntervals.push([start, end]);
      intervalsByDate.set(date, dayIntervals);
    }
  }

  const firstDate = localDateKey(startDate);
  const lastDate = localDateKey(endDate);
  return Array.from(intervalsByDate.entries()).flatMap(([date, intervals]) => {
    if (date < firstDate || date > lastDate) return [];
    const hours = mergeIntervalHours(intervals);
    return hours > 0 && hours <= 24 ? [{ date, hours }] : [];
  });
}

async function readAllRecords<T extends 'RestingHeartRate' | 'SleepSession'>(
  healthConnect: HealthConnectModule,
  recordType: T,
  startDate: Date,
  endDate: Date,
) {
  const records: Array<Awaited<ReturnType<HealthConnectModule['readRecords']>>['records'][number]> = [];
  let pageToken: string | undefined;

  do {
    const page = await healthConnect.readRecords(recordType, {
      timeRangeFilter: dateRange(startDate, endDate),
      ascendingOrder: true,
      pageSize: MAX_PAGE_SIZE,
      ...(pageToken ? { pageToken } : {}),
    });
    records.push(...page.records);
    pageToken = page.pageToken;
  } while (pageToken);

  return records as T extends 'RestingHeartRate'
    ? Array<{ time: string; beatsPerMinute: number }>
    : Array<{
        startTime: string;
        endTime: string;
        stages?: Array<{ startTime: string; endTime: string; stage: number }>;
      }>;
}

async function initializeAvailableHealthConnect() {
  const capability = await getHealthConnectCapability();
  if (capability === 'provider_update_required') {
    throw new HealthConnectError('provider_update_required', 'Health Connect needs to be updated.');
  }
  if (capability !== 'available') {
    throw new HealthConnectError('unavailable', 'Health Connect is unavailable.');
  }

  const healthConnect = loadHealthConnect();
  if (!healthConnect || !(await healthConnect.initialize())) {
    throw new HealthConnectError('unavailable', 'Health Connect is unavailable.');
  }
  return healthConnect;
}

function getGrantedRecordTypes(permissions: ReadonlyArray<{ accessType?: string; recordType?: string }>) {
  const approved = new Set(READ_PERMISSIONS.map((permission) => permission.recordType));
  return new Set(
    permissions
      .filter((permission) => permission.accessType === 'read' && approved.has(permission.recordType as HealthConnectPermission['recordType']))
      .map((permission) => permission.recordType as HealthConnectPermission['recordType']),
  );
}

function dateRange(startDate: Date, endDate: Date) {
  return {
    operator: 'between' as const,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };
}

function metricRow(
  metricType: 'steps' | 'active_mins' | 'resting_hr',
  value: number,
  dateValue: string,
) {
  const date = dateValue.slice(0, 10);
  return {
    metric_type: metricType,
    value,
    recorded_at: `${date}T00:00:00.000Z`,
  };
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
  return Math.round((totalMs / 3_600_000) * 100) / 100;
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampDays(days: number) {
  if (!Number.isFinite(days)) return 7;
  return Math.max(1, Math.min(30, Math.round(days)));
}
