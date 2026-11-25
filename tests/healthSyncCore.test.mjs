import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/healthSyncCore.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Intl, Date, Math, Number, Map, Object, String, Array, Error });
const core = exports;
const plain = (v) => JSON.parse(JSON.stringify(v instanceof Map ? Object.fromEntries(v) : v));
const at = (iso) => Date.parse(iso);
const H = 3_600_000, M = 60_000;

test('account calendar: day keys follow the account zone, not UTC or the phone', () => {
  assert.equal(core.dayKeyIn('Europe/London', at('2026-11-24T23:30:00Z')), '2026-11-24');
  assert.equal(core.dayKeyIn('Asia/Karachi', at('2026-11-24T23:30:00Z')), '2026-11-25', 'UTC+5 is already the next day');
  assert.equal(core.dayKeyIn('America/New_York', at('2026-11-25T03:00:00Z')), '2026-11-24');
  assert.equal(core.dayKeyIn('Asia/Kolkata', at('2026-11-24T18:31:00Z')), '2026-11-25', 'half-hour offset');
});

test('DST: account midnight is found correctly on the clock-change days (25 h and 23 h days)', () => {
  assert.equal(new Date(core.startOfDayIn('Europe/London', '2026-10-25')).toISOString(), '2026-10-24T23:00:00.000Z', 'BST midnight');
  assert.equal(new Date(core.startOfDayIn('Europe/London', '2026-10-26')).toISOString(), '2026-10-26T00:00:00.000Z', 'GMT midnight');
  assert.equal(new Date(core.startOfDayIn('Europe/London', '2026-03-29')).toISOString(), '2026-03-29T00:00:00.000Z');
  assert.equal(new Date(core.startOfDayIn('Europe/London', '2026-03-30')).toISOString(), '2026-03-29T23:00:00.000Z');
  const minutes = core.minutesByDay([[at('2026-10-24T23:00:00Z'), at('2026-10-26T00:00:00Z')]], 'Europe/London');
  assert.deepEqual(plain(minutes), { '2026-10-25': 25 * 60 }, 'the autumn clock-change day has 25 hours');
});

test('workouts: overlapping records (watch + phone) count once; separate ones add up', () => {
  const run = [at('2026-11-24T07:00:00Z'), at('2026-11-24T07:30:00Z')];
  const watchCopy = [at('2026-11-24T07:05:00Z'), at('2026-11-24T07:35:00Z')];
  const evening = [at('2026-11-24T18:00:00Z'), at('2026-11-24T18:20:00Z')];
  assert.deepEqual(plain(core.minutesByDay([run, watchCopy, evening], 'Europe/London')), { '2026-11-24': 55 });
  assert.deepEqual(plain(core.minutesByDay([run, run, run], 'Europe/London')), { '2026-11-24': 30 }, 'repeated import of the same record');
});

test('workouts crossing account midnight are split between the two days', () => {
  const late = [at('2026-11-24T23:40:00Z'), at('2026-11-25T00:10:00Z')];
  assert.deepEqual(plain(core.minutesByDay([late], 'Europe/London')), { '2026-11-24': 20, '2026-11-25': 10 });
  assert.deepEqual(plain(core.minutesByDay([late], 'Asia/Karachi')), { '2026-11-25': 30 }, 'same workout, different account zone');
});

test('sleep: overnight sleep counts on the wake day; naps add to their own day; overlaps from two sources count once', () => {
  const night = [at('2026-11-24T22:30:00Z'), at('2026-11-25T06:30:00Z')];
  const watchNight = [at('2026-11-24T22:45:00Z'), at('2026-11-25T06:40:00Z')];
  const nap = [at('2026-11-25T13:00:00Z'), at('2026-11-25T13:30:00Z')];
  const prior = [at('2026-11-23T23:00:00Z'), at('2026-11-24T07:00:00Z')];
  assert.deepEqual(plain(core.sleepHoursByWakeDay([night, watchNight, nap, prior], 'Europe/London')), { '2026-11-24': 8, '2026-11-25': 8.7 });
});

test('steps from 15-minute slices are bucketed into account days', () => {
  const slices = [
    { start: at('2026-11-24T23:30:00Z'), value: 100 },
    { start: at('2026-11-24T23:45:00Z'), value: 50 },
    { start: at('2026-11-25T00:00:00Z'), value: 25 },
  ];
  assert.deepEqual(plain(core.sumSlicesByDay(slices, 'Europe/London')), { '2026-11-24': 150, '2026-11-25': 25 });
  assert.deepEqual(plain(core.sumSlicesByDay(slices, 'Asia/Karachi')), { '2026-11-25': 175 });
});

test('reconciliation: failed reads and missing permission never send anything (history is kept)', () => {
  const days = ['2026-11-23', '2026-11-24', '2026-11-25'];
  assert.deepEqual(plain(core.reconcileMetric('steps', { state: 'failed' }, days)), []);
  assert.deepEqual(plain(core.reconcileMetric('steps', { state: 'not_permitted' }, days)), []);
  assert.deepEqual(plain(core.reconcileSleep({ state: 'failed' }, days)), []);
});

test('reconciliation: an entirely empty read cannot prove zero (Apple hides denied reads), so nothing is sent', () => {
  const days = ['2026-11-24', '2026-11-25'];
  assert.deepEqual(plain(core.reconcileMetric('active_mins', { state: 'read', values: new Map() }, days)), []);
  assert.deepEqual(plain(core.reconcileMetric('active_mins', { state: 'read', values: new Map([['2026-11-24', 0]]) }, days)), []);
});

test('reconciliation: a read with data sends every window day, including genuine zeros and corrected/deleted days', () => {
  const days = ['2026-11-23', '2026-11-24', '2026-11-25'];
  const rows = core.reconcileMetric('active_mins', { state: 'read', values: new Map([['2026-11-24', 30]]) }, days);
  assert.deepEqual(plain(rows), [
    { metric_type: 'active_mins', value: 0, recorded_at: '2026-11-23T00:00:00.000Z' },
    { metric_type: 'active_mins', value: 30, recorded_at: '2026-11-24T00:00:00.000Z' },
    { metric_type: 'active_mins', value: 0, recorded_at: '2026-11-25T00:00:00.000Z' },
  ]);
});

test('window: days are listed in the account zone across a month boundary', () => {
  assert.deepEqual(plain(core.dayKeysBetween('Europe/London', at('2026-11-29T12:00:00Z'), at('2026-12-01T12:00:00Z'))), ['2026-11-29', '2026-11-30', '2026-12-01']);
  assert.equal(core.isValidTimeZone('Europe/London'), true);
  assert.equal(core.isValidTimeZone('Not/AZone'), false);
  assert.equal(core.isValidTimeZone(null), false);
});

test('session isolation: a sync started by A is stale after logout, account switch or disconnect', async () => {
  let session = 'user-a';
  const guard = core.createHealthSyncGuard('user-a', async () => session);
  assert.equal(await guard.isCurrent(), true);
  await guard.assertCurrent();
  session = 'user-b';
  await assert.rejects(guard.assertCurrent(), (e) => e.name === 'StaleHealthSyncError', 'B signed in before A finished');
  session = 'user-a';
  assert.equal(await guard.isCurrent(), true);
  core.invalidateHealthSyncs();
  await assert.rejects(guard.assertCurrent(), (e) => e.name === 'StaleHealthSyncError', 'disconnect/logout invalidates in-flight work');
  session = null;
  const later = core.createHealthSyncGuard('user-a', async () => session);
  assert.equal(await later.isCurrent(), false, 'signed out');
});

test('sleep corrections: a read with sleep sends zeros for empty days (clears deleted imports); unprovable reads send nothing', () => {
  const days = ['2026-11-23', '2026-11-24', '2026-11-25'];
  assert.deepEqual(plain(core.reconcileSleep({ state: 'read', values: new Map([['2026-11-24', 7.5]]) }, days)), [
    { date: '2026-11-23', hours: 0 }, { date: '2026-11-24', hours: 7.5 }, { date: '2026-11-25', hours: 0 },
  ]);
  assert.deepEqual(plain(core.reconcileSleep({ state: 'read', values: new Map() }, days)), [], 'Apple: empty cannot prove no sleep');
  assert.deepEqual(plain(core.reconcileSleep({ state: 'read', values: new Map() }, days, true)).map((r) => r.hours), [0, 0, 0], 'Health Connect: confirmed permission');
  assert.deepEqual(plain(core.reconcileSleep({ state: 'failed' }, days, true)), []);
});
