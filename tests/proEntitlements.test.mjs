import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('resolved mobile Pro gates use the authenticated server entitlement status', async () => {
  const [dashboard, library, milestone] = await Promise.all([
    read('hooks/useDashboard.ts'),
    read('hooks/useFitnessLibrary.ts'),
    read('screens/subscreens/MilestoneTrackerScreen.tsx'),
  ]);
  assert.match(dashboard, /loadNativeSubscriptionStatus\(\)/);
  assert.match(dashboard, /isPro: subscriptionStatus\?\.isPro === true/);
  assert.match(library, /loadNativeSubscriptionStatus\(\)/);
  assert.match(milestone, /loadNativeSubscriptionStatus\(\)/);
  assert.doesNotMatch(`${dashboard}\n${library}\n${milestone}`, /isProfilePro\(/);
});

test('Free clients retain personal weekly mood and sleep reads but do not receive Pro-derived reports', async () => {
  const [sleep, report, history, weekly, details] = await Promise.all([
    read('hooks/useProgressSleep.ts'),
    read('hooks/useProgressReport.ts'),
    read('hooks/useDadScoreHistory.ts'),
    read('hooks/useWeeklyReport.ts'),
    read('components/dashboard/ScoreDetailSheet.tsx'),
  ]);
  assert.match(sleep, /from\('mood_logs'\)/);
  assert.match(sleep, /from\('sleep_logs'\)/);
  assert.match(sleep, /isPro\s*\?\s*fetchProInsight/);
  assert.match(report, /if \(!userId \|\| !isPro\)/);
  assert.match(report, /fetchProInsight<.*monthly-report/);
  assert.match(history, /fetchProInsight<.*score-history/);
  assert.match(weekly, /!isPro/);
  assert.match(details, /useProgressReport\(sheetUserId, isPro\)/);
});

test('client check-in sync no longer writes authoritative streak state', async () => {
  const [offline, dashboard] = await Promise.all([
    read('lib/offlineSync.ts'),
    read('hooks/useDashboard.ts'),
  ]);
  assert.doesNotMatch(offline, /from\('user_streaks'\)[\s\S]{0,180}\.upsert/);
  assert.doesNotMatch(dashboard, /from\("user_streaks"\)[\s\S]{0,180}\.upsert/);
  assert.match(dashboard, /loadNativeSubscriptionStatus\(\)/);
});

test('streak freeze copy uses the server-provided state and never derives it locally', async () => {
  const [dashboard, card, status] = await Promise.all([
    read('hooks/useDashboard.ts'),
    read('components/dashboard/StreakCard.tsx'),
    read('lib/nativeSubscriptions.ts'),
  ]);
  const screen = await read('screens/DashboardScreen.tsx');
  assert.match(dashboard, /freezeUsedThisWeek: typeof subscriptionStatus\?\.freezeUsedThisWeek === 'boolean'/);
  assert.match(dashboard, /freezesRemaining: typeof subscriptionStatus\?\.freezesRemaining === 'number'/);
  assert.match(dashboard, /freezeUsedThisWeek: null/);
  assert.match(card, /'Freeze used · Resets Monday'/);
  assert.match(card, /Streak protected · \$\{freezesRemaining\}/);
  assert.match(status, /freezeUsedThisWeek\?: boolean/);
  assert.match(status, /freezesRemaining\?: number/);
  assert.match(screen, /freezeUsedThisWeek=\{data\.freezeUsedThisWeek\}/);
  assert.match(screen, /freezesRemaining=\{data\.freezesRemaining\}/);
  assert.doesNotMatch(card, /new Date|user_streak_freezes|week_start/);
});
