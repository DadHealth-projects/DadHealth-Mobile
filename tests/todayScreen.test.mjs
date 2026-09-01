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
    '<DadScoreCard score={score}',
    '<UpgradeProCard',
    "Today's check-in",
    // One focus is the free recommendation and sits directly after the check-in.
    '<TodayFocusCard',
    '<MoodWeekCard',
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

test('score card shows real trends and highlights one weakest pillar', async () => {
  const [screen, scoreCard, hook] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/DadScoreCard.tsx'),
    source('hooks/useDashboard.ts'),
  ]);

  assert.ok(hook.includes('mind_week_change,body_week_change,bond_week_change'));
  assert.ok(screen.includes("highlighted: weakest === 'mind'"));
  assert.ok(screen.includes("highlighted: weakest === 'body'"));
  assert.ok(screen.includes("highlighted: weakest === 'bond'"));
  assert.ok(scoreCard.includes("roundedTrend > 0 ? '↑' : '↓'"));
  assert.ok(screen.includes('points this week.'));
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

test('Today uses flat focus, streak, and challenge sections with a subtle low-Bond warning', async () => {
  const [screen, score, focus, streak, challenge] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/DadScoreCard.tsx'),
    source('components/dashboard/TodayFocusCard.tsx'),
    source('components/dashboard/StreakCard.tsx'),
    source('components/dashboard/ChallengeCard.tsx'),
  ]);

  assert.ok(screen.includes("warning: weakest === 'bond' && breakdown.bond !== null && breakdown.bond < 50"));
  assert.ok(score.includes("backgroundColor: 'rgba(184, 74, 66, 0.2)'"));
  assert.equal(focus.includes("import Card from '../Card'"), false);
  assert.equal(streak.includes("import Card from '../Card'"), false);
  assert.equal(challenge.includes("import Card from '../Card'"), false);
  assert.ok(focus.includes('border-b border-border pb-lg'));
  assert.ok(streak.includes('border-b border-border pb-lg'));
  assert.ok(challenge.includes('border-b border-border pb-lg'));
  assert.ok(screen.includes("title: 'Make time to connect'"));
});
