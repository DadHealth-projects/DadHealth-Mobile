export type DailyCheckInPromptState = {
  userId: string;
  date: string;
  appearances: number;
};

export function parseDailyCheckInPromptState(
  rawValue: string | null,
  userId: string,
  date: string,
): DailyCheckInPromptState;

export function getNextDailyCheckInPrompt(
  state: DailyCheckInPromptState | null,
  userId: string,
  date: string,
  checkInComplete: boolean,
): {
  state: DailyCheckInPromptState;
  shouldShow: boolean;
  reminderNumber: 1 | 2 | 3 | null;
};

export function dailyCheckInReminderCopy(reminderNumber: number | null): string | null;

declare const dailyCheckInPrompt: {
  MAX_DAILY_CHECK_IN_PROMPTS: number;
  parseDailyCheckInPromptState: typeof parseDailyCheckInPromptState;
  getNextDailyCheckInPrompt: typeof getNextDailyCheckInPrompt;
  dailyCheckInReminderCopy: typeof dailyCheckInReminderCopy;
};

export default dailyCheckInPrompt;
