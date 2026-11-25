import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

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
import { markRefreshCompleted, nextRefreshDays } from './healthRefreshWindow';

type HealthConnectModule = typeof import('react-native-health-connect');
type HealthConnectPermission = {
  accessType: 'read';
  recordType: 'Steps' | 'ExerciseSession' | 'SleepSession';
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
    public readonly code: 'unavailable' | 'provider_update_required' | 'permission_denied' | 'not_connected',
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
  /** False when no steps, exercise or sleep data was readable in the window. */
  readableData: boolean;
};

const READ_PERMISSIONS: HealthConnectPermission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ExerciseSession' },
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
  const guard = createHealthSyncGuard(userId, currentSessionUserId);
  const granted = await healthConnect.requestPermission(READ_PERMISSIONS);
  if (getGrantedRecordTypes(granted).size === 0) {
    throw new HealthConnectError('permission_denied', 'Health Connect access was not enabled.');
  }
  await guard.assertCurrent();

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

  const days = options.days ?? await nextRefreshDays('health_connect', userId);
  const result = await syncHealthConnect(userId, days);
  await markRefreshCompleted('health_connect', userId, days);
  return result;
}

export function openHealthConnectSettings() {
  const healthConnect = loadHealthConnect();
  if (!healthConnect) return;
  healthConnect.openHealthConnectSettings();
}

async function performHealthConnectSync(userId: string, days: number): Promise<HealthConnectSyncResult> {
  const guard = createHealthSyncGuard(userId, currentSessionUserId);
  const healthConnect = await initializeAvailableHealthConnect();
  const granted = getGrantedRecordTypes(await healthConnect.getGrantedPermissions());
  if (granted.size === 0) {
    throw new HealthConnectError('permission_denied', 'Health Connect access is not enabled.');
  }

  const timeZone = await accountTimeZone(userId);
  const endMs = Date.now();
  const windowDays = dayKeysBetween(timeZone, endMs - (days - 1) * 86_400_000, endMs);
  const startDate = new Date(startOfDayIn(timeZone, windowDays[0]));
  const endDate = new Date(endMs);
  const notPermitted: ReadOutcome = { state: 'not_permitted' };

  const [steps, exercise, sleep] = await Promise.all([
    granted.has('Steps')
      ? readOutcome(() => queryStepSlices(healthConnect, startDate, endDate).then((slices) => sumSlicesByDay(slices, timeZone)))
      : Promise.resolve(notPermitted),
    granted.has('ExerciseSession')
      ? readOutcome(() => queryExerciseIntervals(healthConnect, startDate, endDate).then((intervals) => minutesByDay(intervals, timeZone)))
      : Promise.resolve(notPermitted),
    granted.has('SleepSession')
      ? readOutcome(() => querySleepIntervals(healthConnect, startDate, endDate).then((intervals) => sleepHoursByWakeDay(intervals, timeZone)))
      : Promise.resolve(notPermitted),
  ]);

  // Health Connect confirms each granted read permission, so an empty successful read is a genuine zero.
  const metrics = [
    ...reconcileMetric('steps', steps, windowDays, true),
    ...reconcileMetric('active_mins', exercise, windowDays, true),
  ];
  const sleepRows = reconcileSleep(sleep, windowDays, true);

  // The server takes the owner from the session token; never upload under a different session.
  await guard.assertCurrent();
  const { data, error } = await supabase.rpc('upsert_health_connect_daily_data', {
    p_metrics: metrics,
    p_sleep: sleepRows,
  });
  // The server rejects uploads without this member's live connection (disconnected
  // elsewhere, or account deletion in progress): stop and show "not linked", don't retry.
  if (error?.message === 'integration_not_connected') {
    activeSyncs.delete(userId);
    throw new HealthConnectError('not_connected', 'The health connection is no longer linked.');
  }
  if (error) throw error;
  markDashboardStale(userId);

  const syncedAt = new Date().toISOString();
  await guard.assertCurrent();
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
    readableData: metrics.some((row) => row.value > 0) || sleepRows.some((row) => row.hours > 0),
  };
}

/**
 * App-level disconnect: stops in-flight and future imports for this account and
 * removes the connection. Health Connect permissions are managed in Health Connect.
 * Imported history is kept unless the member deletes their account.
 */
export async function disconnectHealthConnect(userId: string): Promise<void> {
  invalidateHealthSyncs();
  activeSyncs.delete(userId);
  const { error } = await supabase.from('user_integrations').delete()
    .eq('user_id', userId).eq('provider', HEALTH_CONNECT_PROVIDER);
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

/** 15-minute step totals (Health Connect de-duplicates by app priority), re-bucketed into account days. */
async function queryStepSlices(healthConnect: HealthConnectModule, startDate: Date, endDate: Date) {
  const groups = await healthConnect.aggregateGroupByDuration({
    recordType: 'Steps',
    timeRangeFilter: dateRange(startDate, endDate),
    timeRangeSlicer: { duration: 'MINUTES', length: 15 },
  });
  return groups.flatMap((group) => {
    const value = Number(group.result.COUNT_TOTAL ?? 0);
    const start = new Date(group.startTime).getTime();
    return Number.isFinite(value) && Number.isFinite(start) ? [{ start, value }] : [];
  });
}

/** Actual exercise-session intervals; overlapping sessions from several apps count once. */
async function queryExerciseIntervals(healthConnect: HealthConnectModule, startDate: Date, endDate: Date): Promise<Interval[]> {
  const records = await readAllRecords(healthConnect, 'ExerciseSession', startDate, endDate);
  return records.flatMap((record) => {
    const start = new Date(record.startTime).getTime();
    const end = new Date(record.endTime).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [[start, end] as Interval] : [];
  });
}

async function querySleepIntervals(healthConnect: HealthConnectModule, startDate: Date, endDate: Date): Promise<Interval[]> {
  const queryStart = new Date(startDate.getTime() - 86_400_000);
  const records = await readAllRecords(healthConnect, 'SleepSession', queryStart, endDate);
  return records.flatMap((record) => {
    const stages = record.stages ?? [];
    const asleep = stages.filter((stage) => ASLEEP_STAGE_TYPES.has(Number(stage.stage)));
    const intervals = stages.length > 0
      ? asleep.map((stage) => [new Date(stage.startTime).getTime(), new Date(stage.endTime).getTime()] as Interval)
      : [[new Date(record.startTime).getTime(), new Date(record.endTime).getTime()] as Interval];
    return intervals.filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start);
  });
}

async function readAllRecords(
  healthConnect: HealthConnectModule,
  recordType: 'ExerciseSession' | 'SleepSession',
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

  return records as Array<{
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





function clampDays(days: number) {
  if (!Number.isFinite(days)) return 7;
  return Math.max(1, Math.min(30, Math.round(days)));
}
