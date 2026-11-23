/**
 * Daily check-in reminder times the backend schedules: 08:00 to 20:45 local
 * time, in 15-minute steps (item03_inbox_context). Values use the stored
 * Postgres time format "HH:MM:SS".
 */
export const REMINDER_STEP_MINUTES = 15;
const FIRST_MINUTE = 8 * 60;
const LAST_MINUTE = 20 * 60 + 45;

const format = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;

export const REMINDER_TIMES: readonly string[] = Array.from(
  { length: (LAST_MINUTE - FIRST_MINUTE) / REMINDER_STEP_MINUTES + 1 },
  (_, index) => format(FIRST_MINUTE + index * REMINDER_STEP_MINUTES),
);

export const REMINDER_RANGE_MESSAGE = 'Choose a reminder time between 08:00 and 20:45.';
export const REMINDER_STEP_MESSAGE = 'Reminder times use 15-minute steps. Choose a time ending in :00, :15, :30 or :45.';

/** Null for a schedulable reminder time; otherwise the reason it cannot be used. */
export function reminderTimeError(value: string): string | null {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return REMINDER_RANGE_MESSAGE;
  const hours = Number(match[1]), minutes = Number(match[2]), seconds = Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return REMINDER_RANGE_MESSAGE;
  const total = hours * 60 + minutes;
  if (total < FIRST_MINUTE || total > LAST_MINUTE) return REMINDER_RANGE_MESSAGE;
  if (minutes % REMINDER_STEP_MINUTES !== 0 || seconds !== 0) return REMINDER_STEP_MESSAGE;
  return null;
}
