import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildBodyWeekSeries, latestBodyActivityDate } from '../lib/bodyActivityWeek.js';
import { refreshAfterInFlight } from '../lib/refreshAfterInFlight.js';

const MONDAY_SUNDAY = [
  '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
  '2026-10-16', '2026-10-17', '2026-10-18',
];

test('Body chart aligns manual activity to Monday–Sunday and leaves empty/future days in place', () => {
  const series = buildBodyWeekSeries(MONDAY_SUNDAY, [], [
    { activity_date: '2026-10-12', activity_type: 'running', duration_minutes: 20 },
    { activity_date: '2026-10-15', activity_type: 'crossfit', duration_minutes: 45 },
    { activity_date: '2026-10-19', activity_type: 'gym', duration_minutes: 60 },
  ]);

  assert.deepEqual(series, [2, 0, 0, 4, 0, 0, 0]);
});

test('empty week stays empty; Sunday remains final bucket', () => {
  assert.deepEqual(buildBodyWeekSeries(MONDAY_SUNDAY), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(buildBodyWeekSeries(MONDAY_SUNDAY, [], [
    { activity_date: '2026-10-11', activity_type: 'walking', duration_minutes: 60 },
    { activity_date: '2026-10-19', activity_type: 'gym', duration_minutes: 60 },
  ]), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(buildBodyWeekSeries(MONDAY_SUNDAY, [], [
    { activity_date: '2026-10-18', activity_type: 'walking', duration_minutes: 10 },
  ]), [0, 0, 0, 0, 0, 0, 2]);
});

test('same Body activity logged in both sources counts once; separate logs still count', () => {
  const workouts = [{ performed_at: '2026-10-13T18:00:00-07:00', exercise_name: 'Running', duration_minutes: 30 }];
  const manual = [
    { activity_date: '2026-10-13', activity_type: 'running', duration_minutes: 30 },
    { activity_date: '2026-10-13', activity_type: 'cycling', duration_minutes: 30 },
  ];
  assert.deepEqual(buildBodyWeekSeries(MONDAY_SUNDAY, workouts, manual), [0, 4, 0, 0, 0, 0, 0]);
});

test('last logged date preserves manual date-only value across UTC offsets', () => {
  assert.equal(latestBodyActivityDate(
    [{ performed_at: '2026-10-10T23:30:00-07:00' }],
    [{ activity_date: '2026-10-11' }],
  ), '2026-10-11');
});

test('post-save refresh waits for stale in-flight dashboard request, then fetches again', async () => {
  let release;
  const active = new Promise((resolve) => { release = resolve; });
  const requests = new Map([['user-1', active]]);
  const order = [];
  const pending = refreshAfterInFlight(requests, 'user-1', async () => { order.push('fresh'); });
  await Promise.resolve();
  assert.deepEqual(order, []);
  order.push('old-finished');
  release();
  await pending;
  assert.deepEqual(order, ['old-finished', 'fresh']);
});

test('manual save requests a fresh dashboard read after the write', async () => {
  const screen = await readFile(new URL('../screens/subscreens/ManualActivityLogScreen.tsx', import.meta.url), 'utf8');
  const hook = await readFile(new URL('../hooks/useDashboard.ts', import.meta.url), 'utf8');
  assert.match(screen, /createManualActivity[\s\S]*?refreshDashboardForUser\(user\.id\)/);
  assert.match(hook, /refreshAfterInFlight\(inFlightByUser, userId, loadDashboard\)/);
});

test('score query errors remain separate from valid zero scores', async () => {
  const hook = await readFile(new URL('../hooks/useDashboard.ts', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../screens/DashboardScreen.tsx', import.meta.url), 'utf8');
  assert.match(hook, /scoreError: scoresResult\.error \? SCORE_QUERY_ERROR : null/);
  assert.match(hook, /mindScore: nullableScore\(scoresResult\.data\?\.mind_score\)/);
  assert.match(dashboard, /scoreUnavailable=\{Boolean\(data\.scoreError\)\}/);
});
