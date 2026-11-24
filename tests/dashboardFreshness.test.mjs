import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DASHBOARD_FRESHNESS_MS,
  clearDashboardFreshness,
  dashboardReadGeneration,
  isDashboardFresh,
  markDashboardStale,
  recordCompleteDashboardRead,
} from '../lib/dashboardFreshness.js';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');
const base = { userId: 'user-a', day: '2026-11-24', entitlementKnown: true, hasError: false };

function recordFresh(userId = 'user-a', at = 1_000) {
  recordCompleteDashboardRead(userId, '2026-11-24', at, dashboardReadGeneration(userId));
}

test('a complete read is fresh only inside the window on the same account day', () => {
  clearDashboardFreshness();
  assert.equal(isDashboardFresh({ ...base, now: 1_000 }), false, 'no read yet');
  recordFresh();
  assert.equal(isDashboardFresh({ ...base, now: 1_000 + DASHBOARD_FRESHNESS_MS - 1 }), true);
  assert.equal(isDashboardFresh({ ...base, now: 1_000 + DASHBOARD_FRESHNESS_MS }), false);
  assert.equal(isDashboardFresh({ ...base, day: '2026-11-25', now: 1_500 }), false, 'day change reloads');
  assert.equal(isDashboardFresh({ ...base, now: 500 }), false, 'clock moved backwards reloads');
});

test('unknown access and visible errors always reload', () => {
  clearDashboardFreshness();
  recordFresh();
  assert.equal(isDashboardFresh({ ...base, entitlementKnown: false, now: 1_500 }), false);
  assert.equal(isDashboardFresh({ ...base, hasError: true, now: 1_500 }), false);
});

test('writes mark the account stale, including a read that was already in flight', () => {
  clearDashboardFreshness();
  recordFresh();
  markDashboardStale('user-a');
  assert.equal(isDashboardFresh({ ...base, now: 1_500 }), false);

  const generationAtReadStart = dashboardReadGeneration('user-a');
  markDashboardStale('user-a'); // a save lands while that read is in flight
  recordCompleteDashboardRead('user-a', '2026-11-24', 2_000, generationAtReadStart);
  assert.equal(isDashboardFresh({ ...base, now: 2_100 }), false, 'pre-write read must not count as fresh');
});

test('freshness is per account and cleared on account change', () => {
  clearDashboardFreshness();
  recordFresh('user-a');
  assert.equal(isDashboardFresh({ ...base, userId: 'user-b', now: 1_500 }), false);
  clearDashboardFreshness();
  assert.equal(isDashboardFresh({ ...base, now: 1_500 }), false);
});

test('dashboard hook applies the window only to focus/resume and keeps explicit refreshes immediate', async () => {
  const hook = await source('hooks/useDashboard.ts');
  assert.match(hook, /export function refreshDashboardIfIdle\(userId: string\): Promise<void> \{[\s\S]*?isDashboardFresh\(\{[\s\S]*?entitlementKnown: current\.isPro !== null,[\s\S]*?hasError: Boolean\(store\.error \|\| store\.syncError\),[\s\S]*?return loadDashboard\(userId\);\s*\}/);
  assert.match(hook, /export function refreshDashboardForUser\(userId: string\): Promise<void> \{\s*return refreshAfterInFlight\(inFlightByUser, userId, loadDashboard\);/);
  assert.match(hook, /if \(Object\.values\(result\.failedReads\)\.some\(Boolean\)\) markDashboardStale\(userId\);\s*else recordCompleteDashboardRead\(userId, todayKey\(\), Date\.now\(\), freshnessGeneration\);/);
  assert.match(hook, /inFlightByUser\.clear\(\);\s*clearDashboardFreshness\(\);/);
  assert.match(hook, /if \(event\.status === 'synced'\) markDashboardStale\(userId\);/);
  const refreshBody = hook.slice(hook.indexOf('const refresh = useCallback'), hook.indexOf('const saveCheckIn'));
  assert.doesNotMatch(refreshBody, /refreshDashboardIfIdle|isDashboardFresh/, 'pull-to-refresh stays immediate');
});

test('writes that feed dashboard data mark it stale after server confirmation', async () => {
  const sites = {
    'lib/appleHealth.ts': /if \(error\) throw error;\s*markDashboardStale\(userId\);/,
    'lib/healthConnect.ts': /if \(error\) throw error;\s*markDashboardStale\(userId\);/,
    'lib/communityPostActions.ts': /if \(error \|\| data !== true\) return 'We could not delete this post\.';\s*markDashboardStale\(userId\);/,
    'hooks/useCookTogetherRecipes.ts': /if \(completeError\) return[^\n]*\n\s*markDashboardStale\(userId\);/,
    'hooks/usePresentDadMode.ts': /if \(result\.error\) throw result\.error;[\s\S]{0,80}markDashboardStale\(userId\);/,
    'screens/subscreens/CreateCommunityPostScreen.tsx': /markDashboardStale\(user\.id\);\s*trackEvent\('community_post_created'/,
    'screens/subscreens/CommunityPostThreadScreen.tsx': /markDashboardStale\(user\.id\);\s*trackEvent\('comment_added'/,
    'screens/subscreens/CommunityFeedScreen.tsx': /\} else \{\s*markDashboardStale\(user\.id\);/,
    'screens/subscreens/DadDaysSearchScreen.tsx': /markDashboardStale\(user\.id\);\s*trackEvent\('dad_days_result_saved'/,
    'screens/subscreens/MilestoneTrackerScreen.tsx': /else \{\s*markDashboardStale\(user\.id\);/,
  };
  for (const [path, pattern] of Object.entries(sites)) assert.match(await source(path), pattern, path);
});
