import assert from 'node:assert/strict';
import test from 'node:test';
import promptModule from '../lib/dailyCheckInPrompt.js';

const {
  MAX_DAILY_CHECK_IN_PROMPTS,
  parseDailyCheckInPromptState,
  getNextDailyCheckInPrompt,
  dailyCheckInReminderCopy,
} = promptModule;

test('first opening prompts once with first reminder wording', () => {
  const state = parseDailyCheckInPromptState(null, 'user-a', '2026-11-05');
  const decision = getNextDailyCheckInPrompt(state, 'user-a', '2026-11-05', false);

  assert.equal(decision.shouldShow, true);
  assert.equal(decision.reminderNumber, 1);
  assert.equal(decision.state.appearances, 1);
  assert.equal(dailyCheckInReminderCopy(decision.reminderNumber), 'A moment for you. How are you feeling today?');
});

test('skip leaves appearance count recorded and later openings show second then third reminder', () => {
  const first = getNextDailyCheckInPrompt(null, 'user-a', '2026-11-05', false);
  const second = getNextDailyCheckInPrompt(first.state, 'user-a', '2026-11-05', false);
  const third = getNextDailyCheckInPrompt(second.state, 'user-a', '2026-11-05', false);

  assert.equal(second.reminderNumber, 2);
  assert.equal(dailyCheckInReminderCopy(second.reminderNumber), 'You skipped your check-in earlier. Got a minute for yourself?');
  assert.equal(third.reminderNumber, 3);
  assert.equal(dailyCheckInReminderCopy(third.reminderNumber), "Still haven't checked in today? Take a moment when you're ready.");
  assert.equal(third.state.appearances, MAX_DAILY_CHECK_IN_PROMPTS);
});

test('third skip ends prompts for that user and local day', () => {
  const exhausted = { userId: 'user-a', date: '2026-11-05', appearances: 3 };
  const decision = getNextDailyCheckInPrompt(exhausted, 'user-a', '2026-11-05', false);

  assert.equal(decision.shouldShow, false);
  assert.equal(decision.reminderNumber, null);
});

test('completed check-in stops prompts regardless of remaining appearances', () => {
  const decision = getNextDailyCheckInPrompt(
    { userId: 'user-a', date: '2026-11-05', appearances: 1 },
    'user-a',
    '2026-11-05',
    true,
  );

  assert.equal(decision.shouldShow, false);
});

test('account switch and local date rollover start independent counts', () => {
  const saved = JSON.stringify({ userId: 'user-a', date: '2026-11-05', appearances: 2 });
  const switchedUser = parseDailyCheckInPromptState(saved, 'user-b', '2026-11-05');
  const nextDate = parseDailyCheckInPromptState(saved, 'user-a', '2026-11-06');

  assert.equal(switchedUser.appearances, 0);
  assert.equal(nextDate.appearances, 0);
  assert.equal(getNextDailyCheckInPrompt(switchedUser, 'user-b', '2026-11-05', false).reminderNumber, 1);
  assert.equal(getNextDailyCheckInPrompt(nextDate, 'user-a', '2026-11-06', false).reminderNumber, 1);
});
