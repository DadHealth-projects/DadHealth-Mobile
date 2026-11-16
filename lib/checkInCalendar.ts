/** Calendar metadata from the owner-scoped get_scoring_calendar RPC. */
export type CheckInCalendar = {
  timezone: string;
  changes: { at: string; timezone: string; weekStart: string }[];
};

function dateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function parseCheckInCalendar(value: unknown): CheckInCalendar | null {
  try {
    const row = value as CheckInCalendar;
    if (!row || typeof row.timezone !== 'string' || !Array.isArray(row.changes)) return null;
    new Intl.DateTimeFormat('en-GB', { timeZone: row.timezone });
    const changes = row.changes.map(change => {
      if (!change || typeof change.timezone !== 'string' || !dateKey(change.weekStart) || typeof change.at !== 'string'
        || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(change.at) || !Number.isFinite(Date.parse(change.at))) throw Error('Invalid calendar');
      new Intl.DateTimeFormat('en-GB', { timeZone: change.timezone });
      return { at: change.at, timezone: change.timezone, weekStart: change.weekStart };
    }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return { timezone: row.timezone, changes };
  } catch { return null; }
}

/** Mirrors scoring_date_at's dated zones and westward Monday overlap cap.
 * No device-zone fallback: an unverified calendar must not fabricate a date.
 */
export function checkInDate(calendar: CheckInCalendar | null | undefined, now = new Date()): string | null {
  if (!calendar || !Number.isFinite(now.getTime())) return null;
  let zone = calendar.timezone;
  let cap: string | null = null;
  for (const change of calendar.changes) {
    if (Date.parse(change.at) <= now.getTime()) zone = change.timezone;
    else {
      const previousDay = new Date(Date.parse(`${change.weekStart}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      if (cap === null || previousDay < cap) cap = previousDay;
    }
  }
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return cap !== null && cap < date ? cap : date;
}
