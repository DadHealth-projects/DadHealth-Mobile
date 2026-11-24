const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Readable label for an account calendar date ("Wednesday 18 November").
 * Dates are calendar keys, so they are formatted in UTC to avoid shifting a day
 * in the device's timezone. Unexpected input is returned unchanged.
 */
export function streakDateLabel(date: string): string {
  if (!DATE_KEY.test(date)) return date;
  const value = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) return date;
  const weekday = value.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const month = value.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${weekday} ${value.getUTCDate()} ${month}`;
}

export function protectedDatesText(dates: readonly string[]): string {
  return dates.map(streakDateLabel).join(', ');
}

/**
 * Calm reset line (brief 02: no guilt language). Shown only when the server
 * recorded a reset during the week on screen; never inferred on the device.
 */
export function calmResetMessage(resetOn: string | null | undefined, calendarDays: readonly string[]): string | null {
  if (!resetOn || !DATE_KEY.test(resetOn) || !calendarDays.includes(resetOn)) return null;
  return `Your streak restarted on ${streakDateLabel(resetOn)}. That's okay. Every check-in counts, starting with today's.`;
}
