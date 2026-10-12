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

test('daily check-in uses Mood, Energy, Connection, with optional Sleep', async () => {
  const [panel, moods, dashboard] = await Promise.all([
    source('components/dashboard/CheckInPanel.tsx'),
    source('components/mockup/MoodCheckInRow.tsx'),
    source('hooks/useDashboard.ts'),
  ]);

  for (const label of ['Very low', 'Low', 'Okay', 'Good', 'Great']) assert.ok(moods.includes(`label: '${label}'`));
  for (const label of ['Exhausted', 'Low', 'Okay', 'Good', 'Full of energy', 'Disconnected', 'Distant', 'Neutral', 'Connected', 'Very connected']) {
    assert.ok(panel.includes(`'${label}'`), `Missing check-in option: ${label}`);
  }
  assert.equal(panel.includes('Overwhelmed'), false);
  assert.equal(panel.includes('How stressed do you feel today?'), false);
  assert.ok(panel.includes('Sleep (optional)'));
  assert.ok(dashboard.includes('payload: { date, moodValue, energyLevel, connectionLevel, sleepHours }'));
  assert.ok(dashboard.includes('stress_level: log.stress_level ?? null'));
  assert.ok(dashboard.includes('saveCheckIn(moodValue, energyLevel, connectionLevel, sleepHours)'));
});

test('online and offline check-in saves preserve omitted fields and replay old queue payloads', async () => {
  const [dashboard, storage, sync, recommendation] = await Promise.all([
    source('hooks/useDashboard.ts'),
    source('lib/offlineStorage.ts'),
    source('lib/offlineSync.ts'),
    source('lib/checkInRecommendation.ts'),
  ]);

  assert.ok(dashboard.includes('payload: { date, moodValue, energyLevel, connectionLevel, sleepHours }'));
  assert.ok(storage.includes('stressLevel?: number'));
  assert.ok(storage.includes('energyLevel?: number'));
  assert.ok(storage.includes('connectionLevel?: number'));
  assert.ok(storage.includes('sleepHours?: number | null'));
  assert.ok(sync.includes(".update(moodPayload)"));
  assert.ok(sync.includes(".insert({ user_id: item.userId, date, ...moodPayload })"));
  assert.ok(sync.includes("if (inserted.error.code !== '23505') throw inserted.error"));
  assert.ok(sync.includes('if (existingMood.data)'));
  assert.ok(sync.includes("if (sleepHours != null) await saveManualSleep(item.userId, date, sleepHours)"));
  assert.ok(sync.includes('stressLevel == null ? {} : { stress_level: stressLevel }'));
  assert.ok(sync.includes('energyLevel == null ? {} : { energy_level: energyLevel }'));
  assert.ok(sync.includes('connectionLevel == null ? {} : { connection_level: connectionLevel }'));
  assert.equal(sync.includes(".upsert(moodPayload"), false);
  assert.ok(dashboard.includes('stress_level: previousTodayMood?.stress_level ?? null'));
  assert.match(recommendation, /stressLevel !== null && stressLevel >= 4/);
  assert.match(recommendation, /if \(moodValue <= 2\)/);
  assert.match(recommendation, /stressLevel !== null && stressLevel === 3/);
});

test('Phase 2B migration is additive, nullable, constrained, and leaves RLS/history intact', async () => {
  const migration = await source('../dadHealth/supabase/migrations/20261012120000_daily_checkin_energy_connection.sql');
  const schema = await source('../dadHealth/supabase/schema.sql');
  const scoreMigration = await source('../dadHealth/supabase/migrations/20260925120000_score_detail_canonical_fields.sql');
  const manualScoreMigration = await source('../dadHealth/supabase/migrations/20260928140000_manual_activity_logging.sql');

  assert.match(migration, /add column if not exists energy_level smallint/);
  assert.match(migration, /add column if not exists connection_level smallint/);
  assert.match(migration, /check \(energy_level between 1 and 5\)/);
  assert.match(migration, /check \(connection_level between 1 and 5\)/);
  assert.match(migration, /Null for historical or older-client records/);
  assert.match(migration, /before update on public\.mood_logs[\s\S]*preserve_mood_checkin_optional_values/);
  for (const field of ['stress_level', 'energy_level', 'connection_level']) {
    assert.match(migration, new RegExp(`new\\.${field} is null then new\\.${field} := old\\.${field}`));
  }
  assert.equal(/\b(update|delete|truncate)\s+(public\.)?mood_logs\b/i.test(migration), false);
  assert.equal(/create\s+policy|drop\s+policy|disable\s+row\s+level\s+security/i.test(migration), false);
  assert.match(schema, /energy_level smallint,/);
  assert.match(schema, /connection_level smallint,/);
  assert.match(scoreMigration, /when m\.stress_level is null then/);
  assert.match(scoreMigration, /mood_value - case when m\.mood_scale_version = 1 then 1 else 0 end/);
  assert.match(manualScoreMigration, /from public\.sleep_logs s/);
  assert.match(manualScoreMigration, /from public\.workout_sessions w/);
  assert.match(manualScoreMigration, /from public\.bond_logs bl/);
  assert.doesNotMatch(manualScoreMigration, /energy_level|connection_level/);
  assert.doesNotMatch(migration, /calculate_dad_score_period|sleep_logs|workout_sessions|bond_logs/);
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
