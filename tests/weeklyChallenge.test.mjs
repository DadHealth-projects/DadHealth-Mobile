import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  deriveWeeklyChallengeParticipationState,
  isCurrentWeeklyChallengeContext,
  isCurrentWeeklyChallengeRequest,
} from '../lib/weeklyChallengeState.js';

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
    ".select('challenge_id,user_id,completed_at')",
    "onConflict: 'challenge_id,user_id', ignoreDuplicates: true",
    "supabase.rpc('complete_weekly_challenge'",
    ".eq('id', route.params.challengeId)",
    'p_challenge_id: challenge.id',
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
  assert.ok(screen.includes('deriveWeeklyChallengeParticipationState'));
  assert.ok(screen.includes('isCurrentWeeklyChallengeRequest'));
  assert.equal(screen.includes("start_weekly_challenge"), false);
  assert.equal(screen.includes('started_at'), false);
  assert.equal(screen.includes('challenge_progress'), false);
  assert.equal(screen.includes('How did it feel?'), false);
  assert.equal(screen.includes('Progress'), false);
});

const participation = (challengeId, userId, completedAt = null) => ({
  challengeId,
  userId,
  expectedChallengeId: challengeId,
  expectedUserId: userId,
  joined: true,
  completedAt,
  locallyStarted: false,
});

test('Challenge A completion does not complete Challenge B', () => {
  assert.equal(deriveWeeklyChallengeParticipationState({
    ...participation('challenge-a', 'user-1', '2026-10-12T12:00:00Z'),
    expectedChallengeId: 'challenge-b',
  }), 'not_joined');
});

test('two challenges in one week keep independent completion', () => {
  assert.equal(deriveWeeklyChallengeParticipationState({
    ...participation('challenge-a', 'user-1', '2026-10-12T12:00:00Z'),
    expectedChallengeId: 'challenge-b',
  }), 'not_joined');
  assert.equal(deriveWeeklyChallengeParticipationState(
    participation('challenge-b', 'user-1'),
  ), 'joined');
});

test('new challenge ID next week does not inherit previous completion', () => {
  assert.equal(deriveWeeklyChallengeParticipationState({
    ...participation('week-1-challenge', 'user-1', '2026-10-12T12:00:00Z'),
    expectedChallengeId: 'week-2-challenge',
  }), 'not_joined');
});

test('reopening same completed challenge keeps its completion', () => {
  assert.equal(deriveWeeklyChallengeParticipationState(
    participation('challenge-a', 'user-1', '2026-10-12T12:00:00Z'),
  ), 'completed');
});

test('participation from another user cannot set current user completion', () => {
  assert.equal(deriveWeeklyChallengeParticipationState({
    ...participation('challenge-a', 'user-2', '2026-10-12T12:00:00Z'),
    expectedUserId: 'user-1',
  }), 'not_joined');
});

test('stale request cannot update a different challenge or user screen', () => {
  assert.equal(isCurrentWeeklyChallengeRequest(
    1,
    2,
    { challengeId: 'challenge-a', userId: 'user-1' },
    { challengeId: 'challenge-b', userId: 'user-1' },
  ), false);
  assert.equal(isCurrentWeeklyChallengeContext(
    { challengeId: 'challenge-a', userId: 'user-1' },
    { challengeId: 'challenge-a', userId: 'user-2' },
  ), false);
});
