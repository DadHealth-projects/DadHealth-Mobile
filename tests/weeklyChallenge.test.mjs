import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('mobile Home keeps the compact challenge card and opens the dedicated screen', async () => {
  const [hook, card, dashboard, navigator] = await Promise.all([
    source('hooks/useDashboard.ts'),
    source('components/dashboard/ChallengeCard.tsx'),
    source('screens/DashboardScreen.tsx'),
    source('navigation/AppNavigator.tsx'),
  ]);

  assert.ok(hook.includes(".select('id,title,description,participants_count')"));
  assert.ok(card.includes('participants_count'));
  assert.ok(card.includes("participantCount === 1 ? 'dad' : 'dads'"));
  assert.ok(card.includes('numberOfLines={2}'));
  assert.ok(card.includes('onOpenChallenge'));
  assert.equal(card.includes('onTakeAction'), false);
  assert.equal(card.includes('description'), false);
  assert.ok(dashboard.includes("navigation.navigate('WeeklyChallenge'"));
  assert.equal(dashboard.includes("navigation.navigate('Progress'"), false);
  assert.equal(dashboard.includes('onGoProgress'), false);
  assert.ok(navigator.includes("WeeklyChallenge: { challengeId: string }"));
  assert.ok(navigator.includes('component={WeeklyChallengeScreen}'));
});

test('dedicated mobile challenge screen implements the approved participation lifecycle', async () => {
  const screen = await source('screens/subscreens/WeeklyChallengeScreen.tsx');

  for (const expected of [
    "This week&apos;s challenge",
    'challenge.title',
    'challenge.description',
    "from('weekly_challenge_participants')",
    ".select('challenge_id,completed_at')",
    "onConflict: 'challenge_id,user_id', ignoreDuplicates: true",
    "supabase.rpc('complete_weekly_challenge'",
    "SecureStore.getItemAsync(localStartedKey)",
    "SecureStore.setItemAsync(startedKey(user.id, challenge.id), 'true')",
    "SecureStore.deleteItemAsync(startedKey(user.id, challenge.id))",
    'Ready for this week?',
    'One challenge. One week. A chance to show up where it matters.',
    "This week&apos;s mission",
    'I\'m in',
    "You're in",
    'You made the commitment. Now make it count.',
    'Your challenge',
    'Start challenge',
    'Leave challenge',
    'Challenge on',
    "Go do it. Come back when you're done.",
    'I did it',
    'Challenge completed',
    'You showed up this week.',
    "We couldn't check your challenge status. Please try again.",
    'refreshDashboardForUser',
  ]) {
    assert.ok(screen.includes(expected), `Missing native Weekly Challenge contract: ${expected}`);
  }

  assert.equal(screen.includes('participants_count'), false);
  assert.equal(screen.includes('dad taking part'), false);
  assert.equal(screen.includes('dads taking part'), false);
  assert.equal(screen.includes('mood_logs'), false);
  assert.ok(screen.includes("locallyStarted === 'true' ? 'started' : 'joined'"));
  assert.equal(screen.includes("start_weekly_challenge"), false);
  assert.equal(screen.includes('started_at'), false);
  assert.equal(screen.includes('challenge_progress'), false);
  assert.equal(screen.includes('How did it feel?'), false);
  assert.equal(screen.includes('Progress'), false);
});
