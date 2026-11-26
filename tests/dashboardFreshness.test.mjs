import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  AUTOMATIC_RETRY_MS,
  DASHBOARD_FRESHNESS_MS,
  clearDashboardFreshness,
  dashboardReadGeneration,
  isAutomaticReloadThrottled,
  isDashboardFresh,
  markDashboardStale,
  recordCompleteDashboardRead,
  recordDashboardAttempt,
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

// Production 2026-11-25 21:18-21:36 UTC: one device re-read the full dashboard every 12 s
// (each read hit the 12 s timeout). Automatic retries are now spaced out.
test('automatic reloads after an attempt wait the retry window on the same account day', () => {
  clearDashboardFreshness();
  const at = { userId: 'user-a', day: '2026-11-24' };
  assert.equal(isAutomaticReloadThrottled({ ...at, now: 1_000 }), false, 'no attempt yet');
  recordDashboardAttempt('user-a', '2026-11-24', 1_000);
  assert.equal(isAutomaticReloadThrottled({ ...at, now: 1_000 + 12_000 }), true, 'the 12 s storm cadence is blocked');
  assert.equal(isAutomaticReloadThrottled({ ...at, now: 1_000 + AUTOMATIC_RETRY_MS - 1 }), true);
  assert.equal(isAutomaticReloadThrottled({ ...at, now: 1_000 + AUTOMATIC_RETRY_MS }), false, 'retries after the window');
  assert.equal(isAutomaticReloadThrottled({ ...at, day: '2026-11-25', now: 1_500 }), false, 'day change is never held back');
  assert.equal(isAutomaticReloadThrottled({ ...at, now: 500 }), false, 'clock moved backwards does not block');
  assert.equal(isAutomaticReloadThrottled({ userId: 'user-b', day: '2026-11-24', now: 1_500 }), false, 'per account');
});

test('a write clears the retry backoff so saved changes are re-read on the next focus', () => {
  clearDashboardFreshness();
  recordDashboardAttempt('user-a', '2026-11-24', 1_000);
  markDashboardStale('user-a');
  assert.equal(isAutomaticReloadThrottled({ userId: 'user-a', day: '2026-11-24', now: 1_500 }), false);
  recordDashboardAttempt('user-a', '2026-11-24', 2_000);
  clearDashboardFreshness();
  assert.equal(isAutomaticReloadThrottled({ userId: 'user-a', day: '2026-11-24', now: 2_500 }), false, 'account change clears it');
});

test('dashboard wiring: attempts recorded, only automatic reloads throttled, entitlement budget under the dashboard limit', async () => {
  const hook = await source('hooks/useDashboard.ts');
  const load = hook.slice(hook.indexOf('function loadDashboard('), hook.indexOf('function markDashboardEntitlementUnknown'));
  assert.match(load, /if \(existingRequest\) return existingRequest;[\s\S]*recordDashboardAttempt\(userId, todayKey\(\), Date\.now\(\)\);/, 'joins in-flight before recording a new attempt');
  const idle = hook.slice(hook.indexOf('export function refreshDashboardIfIdle'), hook.indexOf('export function useDashboard'));
  assert.match(idle, /const inFlight = inFlightByUser\.get\(userId\);\s*if \(inFlight\) return inFlight;/);
  assert.match(idle, /isAutomaticReloadThrottled\(\{ userId, day: todayKey\(\), now: Date\.now\(\) \}\)\) return Promise\.resolve\(\);\s*return loadDashboard\(userId\);/);
  const explicit = hook.slice(hook.indexOf('export function refreshDashboardForUser'), hook.indexOf('/**', hook.indexOf('export function refreshDashboardForUser')));
  assert.doesNotMatch(explicit, /Throttled/, 'explicit refreshes are never throttled');
  const budget = Number(hook.match(/DASHBOARD_ENTITLEMENT_BUDGET_MS = ([\d_]+)/)[1].replace(/_/g, ''));
  const limit = Number(hook.match(/function withTimeout<T>\(promise: Promise<T>, ms = (\d+)\)/)[1]);
  assert.ok(budget < limit, 'a slow subscription check cannot time out the whole dashboard');
  assert.match(hook, /withTimeout\(loadNativeSubscriptionStatus\(\), DASHBOARD_ENTITLEMENT_BUDGET_MS\)\.then\(\s*\(status\) => \(\{ status, failed: false \}\),\s*\(\) => \(\{ status: null, failed: true \}\)/);
});
