const MAX_DAILY_CHECK_IN_PROMPTS = 3;

function parseDailyCheckInPromptState(rawValue, userId, date) {
  if (!rawValue) return { userId, date, appearances: 0 };

  try {
    const parsed = JSON.parse(rawValue);
    if (
      parsed?.userId === userId &&
      parsed?.date === date &&
      Number.isInteger(parsed?.appearances) &&
      parsed.appearances >= 0 &&
      parsed.appearances <= MAX_DAILY_CHECK_IN_PROMPTS
    ) {
      return parsed;
    }
  } catch {
    // Invalid local state starts a fresh daily count.
  }

  return { userId, date, appearances: 0 };
}

function getNextDailyCheckInPrompt(state, userId, date, checkInComplete) {
  const sameUserAndDate = state?.userId === userId && state?.date === date;
  const appearances = sameUserAndDate ? state.appearances : 0;
  const nextState = { userId, date, appearances };

  if (checkInComplete || appearances >= MAX_DAILY_CHECK_IN_PROMPTS) {
    return { state: nextState, shouldShow: false, reminderNumber: null };
  }

  const reminderNumber = appearances + 1;
  return {
    state: { userId, date, appearances: reminderNumber },
    shouldShow: true,
    reminderNumber,
  };
}

function dailyCheckInReminderCopy(reminderNumber) {
  if (reminderNumber === 1) return 'A moment for you. How are you feeling today?';
  if (reminderNumber === 2) return 'You skipped your check-in earlier. Got a minute for yourself?';
  if (reminderNumber === 3) return "Still haven't checked in today? Take a moment when you're ready.";
  return null;
}

module.exports = {
  MAX_DAILY_CHECK_IN_PROMPTS,
  parseDailyCheckInPromptState,
  getNextDailyCheckInPrompt,
  dailyCheckInReminderCopy,
};
