/**
 * Platform-independent rules for native health imports (Apple Health, Health Connect).
 * Pure functions, so every rule is unit-tested without a device.
 *
 * - Calendar: all daily buckets use the ACCOUNT timezone (the canonical scoring
 *   calendar), never the phone's, including DST days and half-hour offsets.
 * - Workouts: actual workout/session durations. Overlapping records (for example
 *   watch and phone recording the same run) are merged so they count once, then
 *   split at account midnight.
 * - Sleep: overlapping intervals from any source are merged. Each continuous
 *   block counts on the account day it ENDS (wake day), so overnight sleep and
 *   naps are not double-counted.
 * - Reconciliation: a failed or unreadable read never sends values, so it cannot
 *   erase history. A successful read with data sends every day in the window,
 *   including genuine zeros, so corrections and deleted records are reflected.
 */

export type Interval = readonly [number, number];
export type DailyMetric = { metric_type: 'steps' | 'active_mins'; value: number; recorded_at: string };
export type DailySleep = { date: string; hours: number };

const MINUTE = 60_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** True when the platform recognises the IANA name. */
export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try { partsFormatter(timeZone); return true; } catch { return false; }
}

function zonedParts(timeZone: string, ms: number) {
  const parts = Object.fromEntries(partsFormatter(timeZone).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), h: Number(parts.hour), min: Number(parts.minute), s: Number(parts.second) };
}

/** Account-calendar day (YYYY-MM-DD) for an instant. */
export function dayKeyIn(timeZone: string, ms: number): string {
  const p = zonedParts(timeZone, ms);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Offset (ms) of the zone at an instant: local wall time minus UTC. */
function offsetAt(timeZone: string, ms: number) {
  const p = zonedParts(timeZone, ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Instant of local midnight that starts `dayKey` in the zone (DST-safe). */
export function startOfDayIn(timeZone: string, dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d);
  let guess = wall - offsetAt(timeZone, wall);
  guess = wall - offsetAt(timeZone, guess);
  return guess;
}

export function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Every account day from the day containing startMs to the day containing endMs, inclusive. */
export function dayKeysBetween(timeZone: string, startMs: number, endMs: number): string[] {
  const keys: string[] = [];
  const last = dayKeyIn(timeZone, endMs);
  for (let key = dayKeyIn(timeZone, startMs); key <= last && keys.length < 400; key = nextDayKey(key)) keys.push(key);
  return keys;
}

/** Union of intervals: overlapping or touching records count once. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const valid = intervals.filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s).map(([s, e]) => [s, e] as [number, number]);
  valid.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of valid) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

/** Whole minutes per account day after merging overlaps and splitting at account midnight. */
export function minutesByDay(intervals: readonly Interval[], timeZone: string): Map<string, number> {
  const ms = new Map<string, number>();
  for (const [start, end] of mergeIntervals(intervals)) {
    let cursor = start;
    while (cursor < end) {
      const key = dayKeyIn(timeZone, cursor);
      const boundary = startOfDayIn(timeZone, nextDayKey(key));
      const sliceEnd = Math.min(end, boundary > cursor ? boundary : end);
      ms.set(key, (ms.get(key) ?? 0) + (sliceEnd - cursor));
      cursor = sliceEnd;
    }
  }
  return new Map(Array.from(ms, ([key, value]) => [key, Math.round(value / MINUTE)]));
}

/** Sleep hours per wake day: merged blocks are credited to the account day each block ends on. */
export function sleepHoursByWakeDay(intervals: readonly Interval[], timeZone: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const [start, end] of mergeIntervals(intervals)) {
    const key = dayKeyIn(timeZone, end - 1);
    totals.set(key, (totals.get(key) ?? 0) + (end - start));
  }
  return new Map(Array.from(totals, ([key, value]) => [key, Math.round((value / 3_600_000) * 10) / 10]));
}

/** Sum fixed-length slices (e.g. 15-minute step buckets) into account days. */
export function sumSlicesByDay(slices: ReadonlyArray<{ start: number; value: number }>, timeZone: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const slice of slices) {
    if (!Number.isFinite(slice.start) || !Number.isFinite(slice.value) || slice.value < 0) continue;
    const key = dayKeyIn(timeZone, slice.start);
    totals.set(key, (totals.get(key) ?? 0) + slice.value);
  }
  return totals;
}

export type ReadOutcome =
  | { state: 'read'; values: Map<string, number> }
  | { state: 'failed' }
  | { state: 'not_permitted' };

/**
 * Turn one metric's read into upload rows for the window.
 * - failed / not permitted → nothing (never erase valid history).
 * - read but no data anywhere in the window → nothing. Apple returns an empty
 *   result when read access is denied, so empty cannot prove zero.
 * - read with data → every window day, including genuine zeros (corrections and deletions).
 */
export function reconcileMetric(
  metricType: DailyMetric['metric_type'],
  outcome: ReadOutcome,
  windowDays: readonly string[],
  /** True only when the platform confirms read permission (Health Connect); Apple never does. */
  permissionConfirmed = false,
): DailyMetric[] {
  if (outcome.state !== 'read') return [];
  if (!permissionConfirmed && !windowDays.some((day) => (outcome.values.get(day) ?? 0) > 0)) return [];
  return windowDays.map((day) => ({ metric_type: metricType, value: Math.max(0, Math.round(outcome.values.get(day) ?? 0)), recorded_at: `${day}T00:00:00.000Z` }));
}

/**
 * Sleep follows the same rule as metrics: nothing on a failed or unprovable read;
 * otherwise every window day, with 0 for a day with no sleep. A 0 asks the server to
 * clear that provider's imported row (migration 20261125140000); older servers ignore 0.
 */
export function reconcileSleep(outcome: ReadOutcome, windowDays: readonly string[], permissionConfirmed = false): DailySleep[] {
  if (outcome.state !== 'read') return [];
  if (!permissionConfirmed && !windowDays.some((day) => (outcome.values.get(day) ?? 0) > 0)) return [];
  return windowDays.flatMap((day) => {
    const hours = outcome.values.get(day) ?? 0;
    return hours >= 0 && hours <= 24 ? [{ date: day, hours: hours > 0 ? hours : 0 }] : [];
  });
}

/* ---------------- Account / session isolation ---------------- */

let healthGeneration = 0;

/** Invalidate every in-flight native health sync (logout, account switch, disconnect, deletion). */
export function invalidateHealthSyncs(): void {
  healthGeneration += 1;
}

export class StaleHealthSyncError extends Error {
  constructor() { super('health_sync_stale'); this.name = 'StaleHealthSyncError'; }
}

/**
 * Captured at the start of a sync. `assertCurrent` must pass before every upload
 * and every UI update: the account that started the sync must still be the
 * signed-in session, and nothing may have invalidated syncs meanwhile.
 */
export function createHealthSyncGuard(userId: string, currentSessionUserId: () => Promise<string | null>) {
  const generation = healthGeneration;
  return {
    userId,
    isCurrent: async () => generation === healthGeneration && (await currentSessionUserId()) === userId,
    async assertCurrent() {
      if (generation !== healthGeneration || (await currentSessionUserId()) !== userId) throw new StaleHealthSyncError();
    },
  };
}

/* ---------------- Corrections outside the normal window ---------------- */

export const ROUTINE_WINDOW_DAYS = 7;
export const EXTENDED_WINDOW_DAYS = 30;
export const EXTENDED_REFRESH_EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * Routine syncs re-read 7 days. At most once a day the window widens to 30 days so
 * edits and deletions made weeks ago in Apple Health / Health Connect are reconciled
 * with the same rules (a failed or unprovable read still never erases history).
 */
export function refreshWindowDays(lastExtendedAt: number | null, now: number): number {
  if (lastExtendedAt == null || !Number.isFinite(lastExtendedAt) || lastExtendedAt > now) return EXTENDED_WINDOW_DAYS;
  return now - lastExtendedAt >= EXTENDED_REFRESH_EVERY_MS ? EXTENDED_WINDOW_DAYS : ROUTINE_WINDOW_DAYS;
}
