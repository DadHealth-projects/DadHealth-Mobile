import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('Today follows the approved score-led hierarchy', async () => {
  const screen = await source('screens/DashboardScreen.tsx');
  const signedIn = screen.slice(screen.indexOf('          {data ? ('));
  const ordered = [
    '<GreetingHeader',
    '<DadScoreCard',
    "Today's check-in",
    // One focus is the free recommendation and sits directly after the check-in.
    '<TodayFocusCard',
    '<StreakCard',
    '<SupportingTools',
    '<ChallengeCard',
    '<RemindersList',
  ].map((needle) => signedIn.indexOf(needle));

  ordered.forEach((index) => assert.ok(index >= 0));
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(ordered[index] > ordered[index - 1], 'Today hierarchy is out of order');
  }
  assert.equal(screen.includes('<TodaysPlan'), false);
  assert.equal(signedIn.includes('<MoodWeekCard'), false);
  assert.match(screen, /reminders\.length > 0 \?/);
  assert.ok(screen.includes('<ScoreDetailSheet'));
});

test('daily check-in includes stress and persists it online and offline', async () => {
  const [panel, dashboard, storage, sync] = await Promise.all([
    source('components/dashboard/CheckInPanel.tsx'),
    source('hooks/useDashboard.ts'),
    source('lib/offlineStorage.ts'),
    source('lib/offlineSync.ts'),
  ]);

  for (const copy of ['How stressed do you feel today?', 'Not at all', 'A little', 'Moderate', 'Very', 'Overwhelmed']) {
    assert.ok(panel.includes(copy), `Missing stress option: ${copy}`);
  }
  assert.ok(dashboard.includes('payload: { date, moodValue, stressLevel, sleepHours }'));
  assert.ok(storage.includes('stressLevel?: number'));
  assert.ok(sync.includes("stress_level: stressLevel"));
  assert.ok(sync.includes("throw new Error('invalid_stress')"));
  assert.ok(sync.includes('stressLevel == null ? {}'));
});

test('lowest-pillar focus uses approved tie order and existing destinations', async () => {
  const [helper, screen] = await Promise.all([
    source('lib/todayFocus.ts'),
    source('screens/DashboardScreen.tsx'),
  ]);

  assert.ok(helper.includes("if (!checkedInToday) return 'checkin'"));
  assert.ok(helper.includes("const PILLAR_ORDER = ['mind', 'body', 'bond']"));
  assert.ok(screen.includes("navigation.navigate('BreathingSession')"));
  assert.ok(screen.includes("navigation.navigate('ActiveWorkout'"));
  assert.ok(screen.includes("navigation.navigate('Tabs', { screen: 'Bond' })"));
  assert.ok(screen.includes("actionLabel: 'Start breathing'"));
  assert.ok(screen.includes("actionLabel: 'Start workout'"));
  assert.ok(screen.includes("actionLabel: 'Open Present Dad Mode'"));
});

test('Today score card and detail sheet use canonical values for Free and Pro', async () => {
  const [screen, scoreCard, hook, moments] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/DadScoreCard.tsx'),
    source('hooks/useDashboard.ts'),
    source('lib/proMoments.ts'),
  ]);

  assert.ok(hook.includes('mind_week_change,body_week_change,bond_week_change'));
  assert.ok(screen.includes("highlighted: weakest === 'mind'"));
  assert.ok(screen.includes("highlighted: weakest === 'body'"));
  assert.ok(screen.includes("highlighted: weakest === 'bond'"));
  assert.ok(screen.includes('const trends = [data?.mindWeekChange, data?.bodyWeekChange, data?.bondWeekChange]'));
  assert.ok(scoreCard.includes('formatScoreTrend(item.trend)'));
  assert.ok(screen.includes('trend: trends[0] ?? null, showNeutralTrend: true'));
  assert.ok(screen.includes('trend: trends[1] ?? null, showNeutralTrend: true'));
  assert.ok(screen.includes('trend: trends[2] ?? null'));
  assert.ok(screen.includes('const scoreDetailItems = scoreItems'));
  assert.equal(screen.includes('selectTodayFocus'), false);
  assert.ok(hook.includes('total_score,weakest_pillar,recommended_action'));
  assert.ok(scoreCard.includes('trend.arrow'));
  assert.ok(screen.includes("proTease={!data.isPro ? 'Unlock my insights' : undefined}"));
  assert.ok(screen.includes('accessibilityLabel="Open Dad Health Score details"'));
  assert.equal(screen.includes('lockedValues={!data.isPro}'), false);
  const detail = await source('components/dashboard/ScoreDetailSheet.tsx');
  assert.ok(detail.includes('Score trends'));
  assert.ok(detail.includes('Share report'));
  assert.ok(detail.includes('useProgressReport(sheetUserId)'));
  assert.ok(detail.includes('className="flex-1 rounded-t-[28px] bg-[#111214]"'));
  assert.ok(detail.includes('{!isPro ? <View className="border-y border-border py-md">'));
  assert.ok(moments.includes('Understand your score'));
  assert.ok(moments.includes('personalised insights, weekly trends and recommendations.'));
  assert.ok(moments.includes("cta: 'Unlock my insights'"));
});

test('post-check-in keeps the free recommendation and uses the approved Pro CTA', async () => {
  const [screen, followUp] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/CheckInFollowUp.tsx'),
  ]);

  assert.ok(screen.includes('isPro={data.isPro}'));
  assert.ok(followUp.includes("isPro ? 'Build my plan' : 'See what Pro can do'"));
  assert.ok(followUp.includes('<View className="flex-row items-center justify-between">'));
  assert.equal(followUp.includes('flex-1'), false);
  assert.equal(followUp.includes('<View className="self-start border-b'), false);
  assert.equal(followUp.includes('<View className="self-end border-b'), false);
  assert.equal((followUp.match(/underline decoration-lime/g) ?? []).length, 2);
  assert.ok(screen.includes("setProPrompt('checkIn')"));
});

test('Today supporting tools use existing workout, meal, and Bond routes', async () => {
  const [screen, hook] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('hooks/useDashboard.ts'),
  ]);

  assert.ok(hook.includes(".from('workouts').select('id,title,duration_mins,equipment,exercises').eq('source', 'admin')"));
  assert.ok(screen.includes("key: 'workout'"));
  assert.ok(screen.includes("key: 'meal'"));
  assert.ok(screen.includes("key: 'bond'"));
  assert.ok(screen.includes("navigation.navigate('MealPlanner')"));
});

test('completed check-in retains a visible Mind-score result', async () => {
  const screen = await source('screens/DashboardScreen.tsx');

  assert.ok(screen.includes('Check-in complete'));
  assert.ok(screen.includes('Your Mind score is now'));
  assert.ok(screen.includes('Your check-in feeds into your Mind score'));
  assert.ok(screen.includes('setTimeout(() => setShowCheckInSuccess(false), 3500)'));
  assert.ok(screen.includes('!data.checkedInToday || showCheckInSuccess'));
});

test('Today uses flat sections and warns only for real critical pillar scores', async () => {
  const [screen, score, focus, streak, challenge] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/DadScoreCard.tsx'),
    source('components/dashboard/TodayFocusCard.tsx'),
    source('components/dashboard/StreakCard.tsx'),
    source('components/dashboard/ChallengeCard.tsx'),
  ]);

  assert.ok(screen.includes('[breakdown.mind, breakdown.body, breakdown.bond]'));
  assert.ok(screen.includes('.every((value) => value === 5 || value === 10)'));
  assert.ok(screen.includes("warning: allPillarsCritical && weakest === 'mind'"));
  assert.ok(screen.includes("warning: allPillarsCritical && weakest === 'body'"));
  assert.ok(screen.includes("warning: allPillarsCritical && weakest === 'bond'"));
  assert.ok(score.includes("backgroundColor: 'rgba(184, 74, 66, 0.2)'"));
  assert.equal(score.includes("item.highlighted ? 'bg-dark/10"), false);
  assert.equal(focus.includes("import Card from '../Card'"), false);
  assert.equal(streak.includes("import Card from '../Card'"), false);
  assert.equal(challenge.includes("import Card from '../Card'"), false);
  assert.ok(focus.includes('border-b border-border pb-lg'));
  assert.ok(streak.includes('border-b border-border pb-lg'));
  assert.ok(challenge.includes('border-b border-border pb-lg'));
  assert.ok(screen.includes("title: 'Make time to connect'"));
});
