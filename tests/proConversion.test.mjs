import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('Today carries one Pro moment at a time, never two in one scroll', async () => {
  const screen = await source('screens/DashboardScreen.tsx');
  const signedIn = screen.slice(screen.indexOf('          {data ? ('));

  // Moment 1 after the score, moment 2 after the check-in — mutually exclusive.
  assert.match(signedIn, /!data\.isPro && !showCheckInSuccess/);
  assert.match(signedIn, /!data\.isPro && showCheckInSuccess/);
  assert.equal((signedIn.match(/<UpgradeProCard/g) ?? []).length, 2);

  // Moment 2 only ever appears after the free recommendation it follows.
  const focus = signedIn.indexOf('<TodayFocusCard');
  const momentTwo = signedIn.indexOf('!data.isPro && showCheckInSuccess');
  assert.ok(focus > 0);
  assert.ok(momentTwo > focus);
});

test('the free recommendation keeps the approved Today focus mapping', async () => {
  const [helper, screen] = await Promise.all([
    source('lib/todayFocus.ts'),
    source('screens/DashboardScreen.tsx'),
  ]);

  assert.ok(helper.includes("if (!checkedInToday) return 'checkin'"));
  assert.ok(helper.includes("const PILLAR_ORDER = ['mind', 'body', 'bond']"));
  assert.ok(screen.includes("actionLabel: 'Start breathing'"));
  assert.ok(screen.includes("actionLabel: 'Start workout'"));
  assert.ok(screen.includes("actionLabel: 'Open Present Dad Mode'"));
});

test('moment 1 reports real point deltas and never a fabricated percentage', async () => {
  const [screen, helper] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('lib/todayFocus.ts'),
  ]);

  assert.ok(helper.includes('export function strongestPositiveTrend'));
  assert.ok(screen.includes('points this week.'));
  const insight = /const proInsight = useMemo\(\(\) => \{([\s\S]*?)\}, \[/.exec(screen)?.[1] ?? '';
  assert.ok(insight.length > 0);
  assert.doesNotMatch(insight, /%/);
});

test('Community stays free of Pro promotion', async () => {
  const community = await source('screens/CommunityScreen.tsx');

  assert.doesNotMatch(community, /ProSubscription/);
  assert.doesNotMatch(community, /View Pro/);
});

test('Dad Health Pro has a single account entry point, hidden from Pro members', async () => {
  const account = await source('components/AccountSheet.tsx');

  assert.equal((account.match(/title: 'Dad Health Pro'/g) ?? []).length, 1);
  assert.match(account, /const proRow: Row\[\] = isPro \? \[\]/);
  assert.match(account, /dashboardData\?\.isPro === true/);
});

test('the weekly Pro report uses server week-change data with no invented narrative', async () => {
  const [progress, hook] = await Promise.all([
    source('screens/subscreens/ProgressScreen.tsx'),
    source('hooks/useDashboard.ts'),
  ]);

  assert.ok(hook.includes('mind_week_change,body_week_change,bond_week_change'));
  assert.match(progress, /Your week in Dad Health/);
  assert.match(progress, /dashboard\.data\?\.mindWeekChange/);
  assert.match(progress, /dashboard\.data\?\.bodyWeekChange/);
  assert.match(progress, /dashboard\.data\?\.bondWeekChange/);

  // Point deltas only, and a missing delta is stated rather than filled in.
  const weekChange = /function WeekChange\(([\s\S]*?)\n}/.exec(progress)?.[1] ?? '';
  assert.ok(weekChange.includes('Not enough data yet'));
  assert.ok(weekChange.includes('points'));
  assert.doesNotMatch(weekChange, /%/);

  // No generated coaching copy of the kind the brief mocked up.
  assert.doesNotMatch(progress, /Next week: |consistently but your/);
});

test('the progress tease is built on the real workout count', async () => {
  const progress = await source('screens/subscreens/ProgressScreen.tsx');

  assert.match(progress, /const monthWorkouts = progressReport\.report\?\.workouts \?\? 0;/);
  // Moment 6 is the locked state of the monthly report, so free members get one
  // ask there rather than a lock plus a separate tease.
  assert.match(progress, /monthWorkouts > 0\s*\?\s*`You have completed \$\{monthWorkouts\}/);
  assert.match(progress, /Want to see how your Body score has changed\?/);
  assert.equal((progress.match(/Pro: view your trends/g) ?? []).length, 1);
});

test('Dad Days claims only the allowance Pro actually changes', async () => {
  const screen = await source('screens/subscreens/DadDaysSearchScreen.tsx');

  assert.match(screen, /free Dad Days searches used this month/);
  assert.match(screen, /Pro members get unlimited searches/);
  // Personalisation is not built, so it must not be sold.
  assert.doesNotMatch(screen, /unlimited personalised/i);
  // The existing free filters stay free.
  assert.match(screen, /Search filters/);
  assert.doesNotMatch(screen, /isPro \?[\s\S]{0,80}DropdownTrigger/);
});

test('the AI workout preview describes only inputs that exist', async () => {
  const screen = await source('screens/subscreens/AIWorkoutScreen.tsx');

  assert.match(screen, /With Dad Health Pro/);
  assert.match(screen, /Unlock AI workouts/);
  assert.doesNotMatch(screen, /how you.{0,3}re feeling/i);
  assert.match(screen, /body: JSON\.stringify\(\{ durationMins, equipment, focus \}\)/);
});

test('subscriber recognition is unchanged, including web Stripe members', async () => {
  const [proStatus, service] = await Promise.all([
    source('lib/proStatus.ts'),
    source('lib/nativeSubscriptions.ts'),
  ]);

  assert.match(proStatus, /status === 'active' \|\| status === 'trialing'/);
  assert.match(proStatus, /profile\?\.is_pro === true/);
  // Store architecture untouched.
  assert.match(service, /react-native-iap/);
  assert.match(service, /\/api\/native-subscriptions\/verify\//);
});

test('free tier: therapist directory, milestone logging and the basic score', async () => {
  const [therapistHook, therapistScreen, milestones, progress] = await Promise.all([
    source('hooks/useTherapists.ts'),
    source('screens/subscreens/TherapistDirectoryScreen.tsx'),
    source('screens/subscreens/MilestoneTrackerScreen.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
  ]);

  // Therapist directory is free — no Pro check anywhere in the flow.
  assert.doesNotMatch(therapistHook, /isProfilePro|is_pro/);
  assert.doesNotMatch(therapistScreen, /ProSubscription/);

  // Milestone logging is free; only photos remain Pro.
  assert.doesNotMatch(milestones, /!effectiveIsPro \?/);
  assert.match(milestones, /Photos with Pro/);
  assert.match(milestones, /effectiveIsPro \? <Pressable onPress=\{\(\) => void pickPhoto\(\)\}/);

  // Basic score including the pillar values is free.
  assert.match(progress, /items=\{scoreItems\}/);
  assert.doesNotMatch(progress, /lockedLabel/);
});

test('Pro tier: full TDEE, AI meal plans, reports and mood trends', async () => {
  const [tdee, meals, progress, today, mind] = await Promise.all([
    source('screens/subscreens/TDEECalculatorScreen.tsx'),
    source('screens/subscreens/MealPlannerScreen.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
    source('screens/DashboardScreen.tsx'),
    source('screens/MindScreen.tsx'),
  ]);

  // TDEE: the calculator is free, the targets and insights are Pro.
  assert.match(tdee, /Full TDEE with Pro/);
  assert.match(tdee, /\{isPro \? \(/);
  assert.ok(tdee.indexOf('<ResultStat label="TDEE"') < tdee.indexOf('Full TDEE with Pro'));

  // Meal planner: three free AI generations, then Pro. Reading a saved plan
  // stays free at every point.
  assert.match(meals, /const FREE_AI_MEAL_PLANS = 3;/);
  assert.match(meals, /const limitReached = !library\.isPro && freePlansLeft === 0;/);
  assert.match(meals, /if \(limitReached\) return openPro\(\);/);
  assert.match(meals, /free AI meal plans used/);
  assert.match(meals, /Unlock unlimited meal plans/);
  assert.match(meals, /const activePlan = generatedPlan \?\? savedPlan;/);

  // Reports are Pro on both cadences.
  assert.match(progress, /Monthly report with Pro/);
  assert.match(progress, /progressScore\.data\.isPro \? \(/);

  // The seven-day mood trend is Pro on Today as well as on Mind.
  assert.match(today, /locked=\{!data\.isPro\}/);
  assert.match(mind, /flat locked/);
});

test('every seven-day trend surface is Pro, not just the headline ones', async () => {
  const [today, fitness, progress] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('screens/FitnessScreen.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
  ]);

  // Pillar values are free, but the week-on-week arrows beside them are Pro.
  assert.match(today, /const trendFor = \(change: number \| null \| undefined\) => \(data\?\.isPro \? change \?\? null : null\);/);
  assert.doesNotMatch(today, /trend: data\?\.\w+WeekChange/);

  // Body activity over the week is a progress trend.
  assert.match(fitness, /locked=\{!data\?\.isPro\}/);
  assert.match(fitness, /See your Body trend with Pro/);

  // Mood correlation plots mood against sleep — Pro on both counts.
  const correlation = progress.slice(progress.indexOf('Mood correlation'));
  assert.match(correlation, /!progressScore\.data\.isPro \?/);
  assert.match(correlation, /Mood and sleep together/);
});

test('the weekly report cadence reads as Sunday everywhere it is described', async () => {
  const settings = await source('screens/subscreens/NotificationSettingsScreen.tsx');

  assert.match(settings, /type: 'weekly_score'[\s\S]*?Sunday 08:00/);
  // The weekly challenge keeps its own Monday cadence.
  assert.match(settings, /type: 'weekly_challenge'[\s\S]*?Monday 08:00/);
});

// The Sunday dispatch cadence is server-owned and covered by the web suite
// (`dadHealth/tests/notifications.test.mjs`).
