import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { formatScoreTrend, hasScoreHistory } from '../lib/scoreTrends.js';
import { getCurrentWeekDayKeys } from '../lib/calendarWeek.js';

const root = new URL('../', import.meta.url);

test('canonical changes format as positive, negative, and neutral trends', () => {
  assert.deepEqual(formatScoreTrend(3), { arrow: '↑', change: 3 });
  assert.deepEqual(formatScoreTrend(-3), { arrow: '↓', change: 3 });
  assert.deepEqual(formatScoreTrend(0), { arrow: '→', change: 0 });
});

test('missing previous-week change uses a neutral arrow without inventing a value', () => {
  assert.deepEqual(formatScoreTrend(null), { arrow: '→', change: null });
  assert.deepEqual(formatScoreTrend(undefined), { arrow: '→', change: null });
});

test('empty generated weeks are filtered while weeks with any pillar data remain', () => {
  assert.equal(hasScoreHistory({ mind_has_data: false, body_has_data: false, bond_has_data: false }), false);
  assert.equal(hasScoreHistory({ mind_has_data: true, body_has_data: false, bond_has_data: false }), true);
  assert.equal(hasScoreHistory({ mind_has_data: false, body_has_data: true, bond_has_data: false }), true);
  assert.equal(hasScoreHistory({ mind_has_data: false, body_has_data: false, bond_has_data: true }), true);
});

test('Mind and Body weekday graphs share fixed Monday-to-Sunday calendar keys', async () => {
  const read = (path) => readFile(new URL(path, root), 'utf8');
  const [dashboardUtils, dashboardHook, mind, sleepHook, body] = await Promise.all([
    read('lib/dashboard.utils.ts'),
    read('hooks/useDashboard.ts'),
    read('screens/MindScreen.tsx'),
    read('hooks/useProgressSleep.ts'),
    read('screens/FitnessScreen.tsx'),
  ]);

  assert.match(dashboardUtils, /export \{ getCurrentWeekDayKeys, toLocalDateKey \} from '\.\/calendarWeek'/);
  assert.match(mind, /getMoodWeek\(data\?\.moodLogs \?\? \[\], getCurrentWeekDayKeys\(\)\)/);
  assert.match(sleepHook, /const dates = getCurrentWeekDayKeys\(\)/);
  assert.match(dashboardHook, /const currentWeekDayKeys = getCurrentWeekDayKeys\(\)/);
  assert.match(dashboardHook, /\.gte\('performed_at', bodyWeekStart\.toISOString\(\)\)\.lt\('performed_at', bodyWeekEnd\.toISOString\(\)\)/);
  assert.match(dashboardHook, /toLocalDateKey\(new Date\(row\.performed_at\)\)/);
  assert.match(dashboardHook, /currentWeekDayKeys\.map\(\(dayKey\) => bodyMinutesToBucket\(bodyTotals\.get\(dayKey\) \?\? 0\)\)/);
  assert.match(body, /labels=\{MOOD_WEEK_LABELS\}/);
  assert.match(body, /values=\{data\?\.bodyWeekSeries \?\? EMPTY_BODY_WEEK\}/);
  assert.doesNotMatch(dashboardHook, /date\.setDate\(date\.getDate\(\) - \(6 - index\)\)/);
});

test('calendar week keys stay Monday through Sunday for Monday, Thursday, and Sunday', () => {
  const expected = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
  assert.deepEqual(getCurrentWeekDayKeys(new Date(2026, 8, 24, 12)), expected); // Thursday
  assert.deepEqual(getCurrentWeekDayKeys(new Date(2026, 8, 21, 12)), expected); // Monday
  assert.deepEqual(getCurrentWeekDayKeys(new Date(2026, 8, 27, 12)), expected); // Sunday

  const valuesByDate = new Map([['2026-09-24', 2]]);
  const values = getCurrentWeekDayKeys(new Date(2026, 8, 24, 12)).map((dayKey) => valuesByDate.get(dayKey) ?? 0);
  assert.deepEqual(values, [0, 0, 0, 2, 0, 0, 0]); // Thursday's value stays under Thursday; future days retain their slots
});

test('all score consumers read the canonical pillar fields and share one trend formatter', async () => {
  const read = (path) => readFile(new URL(path, root), 'utf8');
  const [hook, today, card, details, weekly, mind, body, bond, history] = await Promise.all([
    read('hooks/useDashboard.ts'),
    read('screens/DashboardScreen.tsx'),
    read('components/dashboard/DadScoreCard.tsx'),
    read('components/dashboard/ScoreDetailSheet.tsx'),
    read('lib/weeklyReport.ts'),
    read('screens/MindScreen.tsx'),
    read('screens/FitnessScreen.tsx'),
    read('screens/BondScreen.tsx'),
    read('hooks/useDadScoreHistory.ts'),
  ]);

  assert.match(hook, /mind_score,body_score,bond_score,mind_week_change,body_week_change,bond_week_change/);
  assert.match(today, /const scoreDetailItems = scoreItems/);
  assert.match(card, /formatScoreTrend\(item\.trend\)/);
  assert.match(details, /<DadScoreCard score=\{score\} items=\{items\}/);
  assert.match(weekly, /formatPillarChange\(pillar\.change\)/);
  assert.match(weekly, /formatScoreTrend\(change\)/);
  assert.match(weekly, /\$\{trend\.change\} pts/);
  assert.match(card, /\$\{trend\.change\} pts/);
  assert.match(mind, /PillarScoreRow/);
  assert.match(body, /PillarScoreRow/);
  assert.match(bond, /\$\{formattedTrend\.change\} pts/);
  assert.match(mind, /PillarScoreRow pillar="Mind" score=\{data\?\.mindScore \?\? null\} trend=\{data\?\.mindWeekChange \?\? null\}/);
  assert.match(body, /PillarScoreRow pillar="Body" score=\{data\?\.bodyScore \?\? null\} trend=\{data\?\.bodyWeekChange \?\? null\}/);
  assert.match(bond, /BondScoreCard score=\{bondScore\} trend=\{data\?\.bondWeekChange \?\? null\}/);
  assert.match(history, /mind_has_data,body_has_data,bond_has_data/);
});
