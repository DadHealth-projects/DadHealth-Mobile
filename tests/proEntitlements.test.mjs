import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('resolved mobile Pro gates use the authenticated server entitlement status', async () => {
  const [dashboard, library, milestone, fitness, manualHistory] = await Promise.all([
    read('hooks/useDashboard.ts'),
    read('hooks/useFitnessLibrary.ts'),
    read('screens/subscreens/MilestoneTrackerScreen.tsx'),
    read('screens/FitnessScreen.tsx'),
    read('screens/subscreens/ManualActivityHistoryScreen.tsx'),
  ]);
  assert.match(dashboard, /loadNativeSubscriptionStatus\(\)/);
  assert.match(dashboard, /isPro: subscriptionStatus \? subscriptionStatus\.isPro === true : null/);
  assert.match(dashboard, /isPro: null/);
  assert.match(dashboard, /AppState\.addEventListener\('change'/);
  assert.match(dashboard, /useFocusEffect/);
  assert.match(dashboard, /refreshDashboardForUser\(userId\)/);
  assert.match(library, /useState<boolean \| null>\(userId \? null : false\)/);
  assert.match(library, /const pro = subscriptionStatus \? subscriptionStatus\.isPro === true : null/);
  assert.match(fitness, /aiWorkoutAccess === false/);
  assert.match(fitness, /mealPlannerAccess === false/);
  assert.match(library, /loadNativeSubscriptionStatus\(\)/);
  assert.match(milestone, /photoAccess === true/);
  assert.match(milestone, /entitlementKnown/);
  assert.match(manualHistory, /useEntitlement/);
  assert.match(manualHistory, /entitlement\.can\('trends'\)/);
  assert.match(manualHistory, /trendsAccess === true/);
  assert.doesNotMatch(manualHistory, /data\?\.isPro === true/);
  assert.match(library, /AppState\.addEventListener\('change'/);
  assert.match(library, /useFocusEffect/);
  assert.doesNotMatch(`${dashboard}\n${library}\n${milestone}`, /isProfilePro\(/);
});

test('unknown subscription status does not render Free Mind locks or upgrade CTAs', async () => {
  const [mind, dashboard, followUp, details] = await Promise.all([
    read('screens/MindScreen.tsx'),
    read('screens/DashboardScreen.tsx'),
    read('components/dashboard/CheckInFollowUp.tsx'),
    read('components/dashboard/ScoreDetailSheet.tsx'),
  ]);
  assert.match(mind, /mindPlanAccess === false \? \([\s\S]*?<MindPlanLockedCard/);
  assert.match(mind, /trendsAccess === false \? 'View mood trends'/);
  assert.match(dashboard, /proTease=\{scoreInsightsAccess === false/);
  assert.match(dashboard, /<StreakCard[\s\S]*?freezeAccess=\{streakFreezeAccess\}/);
  assert.match(followUp, /planAccess !== null \? <View/);
  assert.match(details, /!isPro && entitlementKnown/);
  const streakCard = await read('components/dashboard/StreakCard.tsx');
  assert.match(streakCard, /freezeAccess === true/);
  assert.match(streakCard, /freezeAccess === false/);
  assert.match(dashboard, /<WeeklyReportCard[\s\S]*?reportAccess=\{weeklyReportAccess\}/);
  const account = await read('components/AccountSheet.tsx');
  assert.match(account, /isConfirmedFree/);
  const weeklyCard = await read('components/dashboard/WeeklyReportCard.tsx');
  assert.match(weeklyCard, /reportAccess === null/);
  assert.match(dashboard, /entitlement\.can\('score_insights'\)/);
});

test('routine resume refresh preserves confirmed access and unknown status does not trigger a render retry loop', async () => {
  const [dashboard, library, native, dadDays] = await Promise.all([
    read('hooks/useDashboard.ts'),
    read('hooks/useFitnessLibrary.ts'),
    read('hooks/useNativeSubscriptions.ts'),
    read('screens/subscreens/DadDaysSearchScreen.tsx'),
  ]);
  assert.match(dashboard, /markDashboardEntitlementUnknown\(userId\);[\s\S]*?if \(isOffline\)/);
  assert.match(dashboard, /if \(!store\.data && !store\.loading\) void loadDashboard\(userId\)/);
  const refresh = dashboard.slice(dashboard.indexOf('export function refreshDashboardForUser'), dashboard.indexOf('export function useDashboard'));
  assert.doesNotMatch(refresh, /markDashboardEntitlementUnknown/);
  const resume = dashboard.slice(dashboard.indexOf("AppState.addEventListener('change'"), dashboard.indexOf('subscribeOfflineSync'));
  assert.doesNotMatch(resume, /markDashboardEntitlementUnknown/);
  assert.match(dashboard, /isPro: null,[\s\S]*?trialActive: null,[\s\S]*?checkedInToday/);
  assert.match(dashboard, /const fallback = current \?\? \(cached && typeof cached === 'object' \? cached : null\)/);
  assert.match(library, /if \(isOffline\) \{[\s\S]*?setIsPro\(userId \? null : false\)/);
  assert.match(library, /requestId !== latestRequest\.current/);
  assert.match(native, /const requestId = \+\+statusRequestId\.current;[\s\S]*?setStatus\(null\)/);
  assert.match(native, /statusRequestId\.current === requestId/);
  assert.match(dadDays, /setAccessReady\(false\);[\s\S]*?loadAccess\(\)/);
  assert.match(dadDays, /useFocusEffect/);
  assert.match(dadDays, /requestId !== accessRequestId\.current/);
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
