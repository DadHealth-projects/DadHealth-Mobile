import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import refreshStateModule from '../lib/dashboardRefreshState.js';
import entitlementAccess from '../lib/proEntitlementAccess.js';

const { mergeDashboardRefreshState } = refreshStateModule;
const { canAccessFeature } = entitlementAccess;
const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

const snapshot = (overrides = {}) => ({
  isPro: null,
  trialActive: null,
  freezeUsedThisWeek: null,
  freezesRemaining: null,
  checkedInToday: null,
  moodLogs: [],
  streak: null,
  totalScore: null,
  mindScore: null,
  bodyScore: null,
  bondScore: null,
  mindWeekChange: null,
  bodyWeekChange: null,
  bondWeekChange: null,
  baselineAvailable: false,
  scoreError: null,
  weakestPillar: null,
  recommendedAction: null,
  ...overrides,
});

test('same-account refresh failures retain confirmed Pro, Free, check-in, streak and score state', () => {
  const previous = snapshot({
    isPro: true,
    trialActive: true,
    checkedInToday: true,
    moodLogs: [{ date: '2026-10-18', mood_value: 2 }],
    streak: 8,
    totalScore: 61,
    mindScore: 50,
  });
  const next = snapshot({ totalScore: null, checkedInToday: null });
  const merged = mergeDashboardRefreshState('user-1', 'user-1', previous, next, {
    entitlement: true,
    mood: true,
    streak: true,
    score: true,
  });
  assert.equal(merged.isPro, true);
  assert.equal(merged.trialActive, true);
  assert.equal(merged.checkedInToday, true);
  assert.equal(merged.moodLogs.length, 1);
  assert.equal(merged.streak, 8);
  assert.equal(merged.totalScore, 61);
  assert.equal(canAccessFeature('weekly_report', merged.isPro, merged.trialActive), true);

  const free = mergeDashboardRefreshState('user-1', 'user-1', snapshot({ isPro: false }), next, { entitlement: true });
  assert.equal(free.isPro, false);
  assert.equal(canAccessFeature('weekly_report', free.isPro, free.trialActive), false);
});

test('a verified downgrade applies immediately and a manual grant remains server-confirmed Pro', () => {
  const next = snapshot({ isPro: false, trialActive: false });
  const downgraded = mergeDashboardRefreshState('user-1', 'user-1', snapshot({ isPro: true }), next, {});
  const manualGrant = mergeDashboardRefreshState('user-1', 'user-1', snapshot(), snapshot({ isPro: true }), {});
  assert.equal(downgraded.isPro, false);
  assert.equal(canAccessFeature('ai_workout', downgraded.isPro, downgraded.trialActive), false);
  assert.equal(manualGrant.isPro, true);
  assert.equal(canAccessFeature('ai_workout', manualGrant.isPro, manualGrant.trialActive), true);
});

test('account switching never carries the previous account entitlement or completion state', () => {
  const previous = snapshot({ isPro: true, checkedInToday: true, streak: 12 });
  const next = snapshot({ isPro: null, checkedInToday: null, streak: null });
  assert.deepEqual(mergeDashboardRefreshState('user-2', 'user-1', previous, next, {
    entitlement: true, mood: true, streak: true,
  }), next);
});

test('Today retains loaded content during refresh and shows neutral failed-read states', async () => {
  const [screen, hook, streak, report] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('hooks/useDashboard.ts'),
    source('components/dashboard/StreakCard.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
  ]);
  assert.match(screen, /const showHomeSkeleton = \(!data && !dashboardError\);/);
  assert.match(screen, /data\.checkedInToday === null/);
  assert.match(hook, /checkedInToday: moodsResult\.error \? null/);
  assert.match(streak, /streak === null/);
  assert.match(report, /currentScore/);
});

test('resume refresh is active-screen scoped and coalesces with an in-flight dashboard read', async () => {
  const hook = await source('hooks/useDashboard.ts');
  assert.match(hook, /export function refreshDashboardIfIdle\(userId: string\): Promise<void> \{\s*return loadDashboard\(userId\);/);
  assert.match(hook, /useFocusEffect\(useCallback\(\(\) => \{[\s\S]*?AppState\.addEventListener/);
  assert.match(hook, /refreshDashboardIfIdle\(userId\)/);
  assert.doesNotMatch(hook, /useEffect\(\(\) => \{\s*if \(!userId\) return;\s*let previousState = AppState\.currentState/);
});

test('Free weekly-report teaser receives the canonical score and does not fetch the Pro report', async () => {
  const [screen, card, reportHook] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('hooks/useWeeklyReport.ts'),
  ]);
  assert.match(screen, /currentScore=\{data\.totalScore\}/);
  assert.match(card, /Current Dad Health Score/);
  assert.match(reportHook, /if \(!userId \|\| !isPro \|\| !enabled \|\| isOffline\)/);
});
