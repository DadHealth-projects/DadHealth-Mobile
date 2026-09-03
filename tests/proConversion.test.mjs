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

test('every upgrade moment is wired to the screen the brief places it on', async () => {
  const [scoreTease, checkIn, weekly, body, dadDays, progress] = await Promise.all([
    source('components/dashboard/UpgradeProCard.tsx'),
    source('components/dashboard/CheckInFollowUp.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('screens/FitnessScreen.tsx'),
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
  ]);

  assert.ok(scoreTease.includes('PRO_MOMENTS.score'));
  assert.ok(checkIn.includes('PRO_MOMENTS.checkIn'));
  assert.ok(weekly.includes('PRO_MOMENTS.weeklyReport'));
  assert.ok(body.includes('PRO_MOMENTS.aiWorkout'));
  assert.ok(dadDays.includes('PRO_MOMENTS.dadDays'));
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
  // The free step renders above the compact Pro trigger, never the other way round.
  assert.ok(followUp.indexOf('advice.recommendation') < followUp.indexOf('<ProPromptModal'));
  assert.ok(followUp.includes('{!isPro ?'));
  assert.ok(dashboard.includes('<CheckInFollowUp'));
  assert.ok(dashboard.includes('data.checkedInToday ? ('));
});

test('Moment 7 counts searches used, as the brief words it', async () => {
  const dadDays = await source('screens/subscreens/DadDaysSearchScreen.tsx');

  assert.ok(dadDays.includes('free Dad Days searches used this month.'));
  assert.equal(dadDays.includes('free searches remaining'), false);
  assert.ok(dadDays.includes('FREE_LIMIT = 3'));
});

test('Moment 3 separates the free generator from personalised Pro workouts', async () => {
  const [freeScreen, proScreen, library, body, navigator, request] = await Promise.all([
    source('screens/subscreens/AIWorkoutScreen.tsx'),
    source('screens/subscreens/PersonalisedAIWorkoutScreen.tsx'),
    source('hooks/useFitnessLibrary.ts'),
    source('screens/FitnessScreen.tsx'),
    source('navigation/AppNavigator.tsx'),
    source('lib/aiWorkout.ts'),
  ]);

  assert.ok(freeScreen.includes("{ mode: 'basic' }"));
  assert.equal(freeScreen.includes('MOOD_OPTIONS'), false);
  assert.equal(freeScreen.includes('PRO_MOMENTS'), false);
  assert.equal(freeScreen.includes("mode: 'personalised'"), false);
  assert.ok(proScreen.includes("mode: 'personalised'"));
  assert.ok(proScreen.includes('MOOD_OPTIONS'));
  assert.ok(proScreen.includes('durationMins'));
  assert.ok(proScreen.includes('equipment'));
  assert.ok(proScreen.includes('!library.isPro'));
  assert.ok(request.includes("mode: 'basic'"));
  assert.ok(request.includes("mode: 'personalised'"));
  assert.ok(library.includes('setWorkouts([...generatedWorkouts, ...adminWorkouts])'));
  assert.ok(body.indexOf('Free workout') < body.indexOf('PRO_MOMENTS.aiWorkout'));
  assert.ok(body.includes("if (fitnessLibrary.isPro) navigation.navigate('PersonalisedAIWorkout')"));
  assert.ok(body.includes('<ProPromptModal'));
  assert.ok(navigator.includes('name="PersonalisedAIWorkout"'));
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
  // Free members request the report before the full Pro value proposition appears.
  assert.ok(card.includes('<ProPromptModal'));
  assert.equal(card.includes('<ProLockedPreview'), false);
  assert.ok(dashboard.includes('isWeeklyReportDay()'));
  assert.ok(dashboard.includes('{showWeeklyReport ? ('));
  assert.ok(progress.includes('<WeeklyReportCard'));
});

test('conversion moments stay compact until the user asks for Pro', async () => {
  const [prompt, score, body, dadDays, weekly, progress] = await Promise.all([
    source('components/ProPromptModal.tsx'),
    source('components/dashboard/UpgradeProCard.tsx'),
    source('screens/FitnessScreen.tsx'),
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('screens/subscreens/ProgressScreen.tsx'),
  ]);

  assert.ok(prompt.includes('Not now'));
  assert.ok(prompt.includes('onRequestClose={onDismiss}'));
  assert.ok(prompt.includes('onPress={onDismiss}'));
  assert.ok(score.includes('Understand your score'));
  assert.equal(score.includes('<ProUpgradeSection'), false);
  assert.ok(body.includes('Make it personal'));
  assert.equal(body.includes('moment={PRO_MOMENTS.aiWorkout} onPress='), false);
  assert.ok(dadDays.includes('free Dad Days searches used this month.'));
  assert.ok(dadDays.includes("setProPrompt('limit')"));
  assert.equal(dadDays.includes('<ProUpgradeSection'), false);
  assert.ok(weekly.includes('Learn about weekly Dad Health reports'));
  assert.ok(progress.includes("See what's driving your score"));
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
  assert.ok(progress.includes('PRO_LOCKS.monthlyReport'));
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
