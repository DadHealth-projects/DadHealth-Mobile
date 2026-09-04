import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('the brief specifies seven upgrade moments and there are exactly seven', async () => {
  const moments = await source('lib/proMoments.ts');

  const block = /export const PRO_MOMENTS[^=]*= \{([\s\S]*?)\n\};/.exec(moments)?.[1] ?? '';
  assert.ok(block.length > 0, 'PRO_MOMENTS block not found');
  assert.equal((block.match(/\n {4}cta: /g) ?? []).length, 7);

  for (const id of ['score', 'checkIn', 'aiWorkout', 'dadDays', 'weeklyReport', 'progressTrends', 'dadDaysCounter']) {
    assert.ok(new RegExp(`\\n  ${id}: \\{`).test(block), `Missing upgrade moment: ${id}`);
  }
});

test('each upgrade moment keeps the wording from the brief', async () => {
  const moments = await source('lib/proMoments.ts');

  const copy = [
    'Pro members get personalised insights, weekly trends and recommendations.',
    'Get a personalised plan based on your mood, activity and Dad Health Score.',
    "We'll build your workout around you.",
    "Child's age · Budget · Time available · Distance · What they enjoy",
    'Your week in Dad Health',
    'Get unlimited personalised Dad Days searches.',
  ];
  for (const line of copy) {
    assert.ok(moments.includes(line), `Missing brief copy: ${line}`);
  }
  assert.ok(moments.includes("cta: 'Unlock my insights'"));
  assert.ok(moments.includes("cta: 'Unlock AI workouts'"));
  assert.ok(moments.includes("cta: 'Personalise my Dad Days'"));
  assert.ok(moments.includes("cta: 'View your trends'"));
  assert.ok(moments.includes("cta: 'Upgrade to Pro'"));
});

test('approved conversion entry points use the existing Pro prompt', async () => {
  const [dashboard, checkIn, weekly, aiWorkout, dadDays, progress] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/CheckInFollowUp.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('screens/subscreens/AIWorkoutScreen.tsx'),
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
  ]);

  assert.ok(dashboard.includes("setProPrompt('score')"));
  assert.ok(dashboard.includes("setProPrompt('checkIn')"));
  assert.ok(dashboard.includes("setProPrompt('weeklyReport')"));
  assert.ok(checkIn.includes('See what Pro can do'));
  assert.ok(weekly.includes('PRO_MOMENTS.weeklyReport'));
  assert.ok(aiWorkout.includes('PRO_MOMENTS.aiWorkout'));
  assert.ok(dadDays.includes('PRO_MOMENTS.dadDaysCounter'));
  assert.ok(progress.includes('PRO_MOMENTS.progressTrends'));
});

test('Moment 2 gives a free recommendation before it mentions Pro', async () => {
  const [advice, followUp, dashboard] = await Promise.all([
    source('lib/checkInRecommendation.ts'),
    source('components/dashboard/CheckInFollowUp.tsx'),
    source('screens/DashboardScreen.tsx'),
  ]);

  assert.ok(advice.includes("state: \"You're feeling stressed today.\""));
  assert.ok(advice.includes('stressLevel >= 4'));
  assert.ok(followUp.indexOf('advice.recommendation') < followUp.indexOf("isPro ? 'Build my plan' : 'See what Pro can do'"));
  assert.ok(followUp.includes("isPro ? 'Build my plan' : 'See what Pro can do'"));
  assert.ok(dashboard.includes('<CheckInFollowUp'));
  assert.ok(dashboard.includes('isPro={data.isPro}'));
  assert.ok(dashboard.includes("setProPrompt('checkIn')"));
  assert.ok(dashboard.includes('data.checkedInToday ? ('));
});

test('Moment 7 counts searches used, as the brief words it', async () => {
  const dadDays = await source('screens/subscreens/DadDaysSearchScreen.tsx');

  assert.ok(dadDays.includes('free Dad Days searches used this month.'));
  assert.equal(dadDays.includes('free searches remaining'), false);
  assert.ok(dadDays.includes('FREE_LIMIT = 3'));
});

test('Moment 3 keeps one AI workout screen and prompts only at the Free limit', async () => {
  const [screen, navigator] = await Promise.all([
    source('screens/subscreens/AIWorkoutScreen.tsx'),
    source('navigation/AppNavigator.tsx'),
  ]);

  assert.ok(screen.includes('three generations monthly for Free, unlimited for Pro'));
  assert.ok(screen.includes("cause.code === 'free_limit_reached'"));
  assert.ok(screen.includes('setLimitPromptOpen(true)'));
  assert.ok(screen.includes('moment={PRO_MOMENTS.aiWorkout}'));
  assert.equal(screen.includes('PersonalisedAIWorkout'), false);
  assert.equal(navigator.includes('name="PersonalisedAIWorkout"'), false);
});

test('the weekly Sunday report is a Pro feature and never invents a week', async () => {
  const [report, card, dashboard, progress] = await Promise.all([
    source('lib/weeklyReport.ts'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('screens/DashboardScreen.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
  ]);

  assert.ok(report.includes('date.getDay() === 0'));
  assert.ok(report.includes('if (pillars.every((pillar) => pillar.change === null)) return null;'));
  assert.ok(report.includes('Next week: Focus on'));
  const freeBranch = card.slice(card.indexOf('if (!isPro)'), card.indexOf('\n  return (', card.indexOf('if (!isPro)')));
  assert.ok(freeBranch.includes('Learn about weekly Dad Health reports'));
  assert.ok(freeBranch.includes('PRO_MOMENTS.weeklyReport.body'));
  assert.ok(freeBranch.includes('onPress={onUpgrade}'));
  assert.equal(freeBranch.includes('<WeeklyReportBody'), false);
  assert.equal(card.includes('<ProLockedPreview'), false);
  assert.ok(dashboard.includes('isWeeklyReportDay()'));
  assert.ok(dashboard.includes('{showWeeklyReport ? ('));
  assert.ok(dashboard.includes("setProPrompt('weeklyReport')"));
  assert.ok(progress.includes('<WeeklyReportCard'));
});

test('conversion moments stay compact until the user asks for Pro', async () => {
  const [prompt, dashboard, aiWorkout, dadDays, weekly, progress] = await Promise.all([
    source('components/ProPromptModal.tsx'),
    source('screens/DashboardScreen.tsx'),
    source('screens/subscreens/AIWorkoutScreen.tsx'),
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
  ]);

  assert.ok(prompt.includes('Not now'));
  assert.ok(prompt.includes('onRequestClose={onDismiss}'));
  assert.ok(prompt.includes('onPress={onDismiss}'));
  assert.ok(dashboard.includes('actionLabel="Unlock my insights"'));
  assert.ok(dashboard.includes("setProPrompt('score')"));
  assert.ok(aiWorkout.includes("cause.code === 'free_limit_reached'"));
  assert.ok(dadDays.includes('free Dad Days searches used this month.'));
  assert.ok(dadDays.includes('setLimitPromptOpen(true)'));
  assert.equal(dadDays.includes('<ProUpgradeSection'), false);
  assert.ok(weekly.includes('Learn about weekly Dad Health reports'));
  assert.ok(progress.includes('Want to see how your Body score has changed?'));
  assert.ok(progress.includes("setProPrompt('progressTrends')"));
  assert.ok(progress.includes("setProPrompt('weeklyReport')"));
  assert.ok(progress.includes('<ProPromptModal'));
  assert.equal(progress.includes('<ProUpgradeSection'), false);
});

test('streak protection is a Pro benefit and degrades safely', async () => {
  const [sync, card] = await Promise.all([
    source('lib/offlineSync.ts'),
    source('components/dashboard/StreakCard.tsx'),
  ]);

  assert.ok(sync.includes('export function countStreakDays('));
  // Exactly one missed day is forgiven, and only for protected members.
  assert.ok(sync.includes('protectionAvailable && !graceUsed && date === previousDate(expected)'));
  assert.ok(sync.includes('graceUsed = true;'));
  // A failed profile read must never fail the check-in save.
  assert.ok(sync.includes('profile.error ? false : isProfilePro(profile.data)'));
  assert.ok(card.includes('Streak protected'));
  assert.ok(card.includes('Protect my streak'));
});

test('the free and Pro split matches the brief table', async () => {
  const [therapist, milestones, tdee, planner, progress, mind, dashboard] = await Promise.all([
    source('screens/subscreens/TherapistDirectoryScreen.tsx'),
    source('screens/subscreens/MilestoneTrackerScreen.tsx'),
    source('screens/subscreens/TDEECalculatorScreen.tsx'),
    source('screens/subscreens/MealPlannerScreen.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
    source('screens/MindScreen.tsx'),
    source('screens/DashboardScreen.tsx'),
  ]);

  // Mind free column: therapist directory is not behind Pro.
  assert.equal(therapist.includes('directory.isPro'), false);

  // Bond free column: milestone logging is free, photos are the Pro layer.
  assert.ok(milestones.includes("<LimeButton label={editingId ? 'Update milestone' : 'Save milestone'}"));
  assert.ok(milestones.includes('PRO_LOCKS.milestonePhotos'));
  assert.ok(milestones.includes('{effectiveIsPro ? <Pressable onPress={() => void pickPhoto(milestone.id)}'));

  // Pro columns, each behind a visible preview.
  assert.ok(tdee.includes('PRO_LOCKS.fullTdee'));
  assert.ok(tdee.includes('const isPro = dashboard?.isPro === true;'));
  assert.ok(planner.includes('PRO_LOCKS.mealPlanner'));
  assert.equal(progress.includes('lockedValues={!isPro}'), false);
  assert.equal(progress.includes('<ProLockedPreview'), false);
  assert.ok(progress.includes('{reportStats.map(([value, label])'));
  assert.match(progress, /\{isPro \? \([\s\S]*?<WeeklyReportCard report=\{weeklyReport\} isPro/);
  assert.ok(progress.includes('dashboardData ? dashboardData.bondScore : progressScore.data.breakdown.bond'));
  assert.ok(progress.includes('[breakdown.mind, breakdown.body, breakdown.bond]'));
  assert.ok(progress.includes('.every((value) => value === 5 || value === 10)'));
  assert.ok(progress.includes("warning: allPillarsCritical && weakest === 'mind'"));
  assert.ok(progress.includes("warning: allPillarsCritical && weakest === 'body'"));
  assert.ok(progress.includes("warning: allPillarsCritical && weakest === 'bond'"));
  assert.ok(mind.includes('PRO_LOCKS.moodTrends'));
  assert.ok(dashboard.includes('PRO_LOCKS.moodTrends'));
});

test('locks show a preview and never lead with the lock icon', async () => {
  const [section, preview, moments] = await Promise.all([
    source('components/ProUpgradeSection.tsx'),
    source('components/ProLockedPreview.tsx'),
    source('lib/proMoments.ts'),
  ]);

  // "Do not make the lock icon the first thing on any screen."
  assert.ok(section.indexOf('{moment.eyebrow}') < section.indexOf('name="lock"'));
  assert.ok(preview.indexOf('{children}') < preview.indexOf('name="lock"'));
  // "Never block a feature without showing a preview of what is behind the lock."
  assert.ok(preview.includes('{children}'));
  assert.ok(preview.includes('pointerEvents="none"'));
  // "Do not show 🚨 UPGRADE TO PRO on every screen."
  assert.equal(moments.includes('🚨'), false);
  assert.equal(moments.includes('UPGRADE TO PRO'), false);
});

test('the paywall is the only place Pro is sold', async () => {
  const [navigator, paywall] = await Promise.all([
    source('navigation/AppNavigator.tsx'),
    source('screens/subscreens/ProSubscriptionScreen.tsx'),
  ]);

  // No paywall on first open: it is a pushed screen, never the initial route.
  assert.ok(navigator.includes("initialRouteName = 'Tabs'"));
  assert.ok(paywall.includes("headline={'Make Dad Health\\npersonal'}"));
  assert.ok(paywall.indexOf('title="Annual"') < paywall.indexOf('title="Monthly"'));
  assert.ok(paywall.includes('Start my 7-day free trial'));
  assert.ok(paywall.includes('The version of you your kids deserve'));
});
