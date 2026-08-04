/**
 * Port of `dadHealth/src/lib/dashboard.utils.ts`.
 *
 * The web dashboard and the mobile dashboard must produce identical numbers and
 * identical wording, so the maths lives in one place per platform and is copied
 * literally rather than re-derived.
 */

export type DashboardScoreSource = {
  total_score?: number | string | null;
  mind_score?: number | null;
  body_score?: number | null;
  bond_score?: number | null;
};

export type MoodLog = {
  date: string;
  mood_value: number;
};

export function getDashboardScore(
  dashboard: DashboardScoreSource | null | undefined,
  hasUser: boolean,
): number | null {
  if (typeof dashboard?.total_score === 'number') return Math.round(dashboard.total_score);
  if (!hasUser) return null;
  const mind = dashboard?.mind_score;
  const body = dashboard?.body_score;
  const bond = dashboard?.bond_score;
  if (typeof mind === 'number' && typeof body === 'number' && typeof bond === 'number') {
    return Math.round((mind + body + bond) / 3);
  }
  return null;
}

export function getScoreBreakdown(
  dashboard: DashboardScoreSource | null | undefined,
  hasUser: boolean,
): { mind: number | null; body: number | null; bond: number | null } {
  if (!hasUser || !dashboard) return { mind: null, body: null, bond: null };
  const clamp = (value: unknown) =>
    typeof value === 'number'
      ? Math.min(100, Math.max(0, Math.round(value)))
      : null;
  return {
    mind: clamp(dashboard.mind_score),
    body: clamp(dashboard.body_score),
    bond: clamp(dashboard.bond_score),
  };
}

export function getLastSevenDayKeys(): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
}

export function getMoodWeek(moodLogs: MoodLog[], dayKeys: string[]): number[] {
  const moodMap = new Map(moodLogs.map((log) => [log.date, log.mood_value]));
  return dayKeys.map((key) => moodMap.get(key) ?? 0);
}

/** Web wording: Great / Good / Okay / Low, with " (x.x/4)" appended. */
export function getMoodSummary(
  moodWeek: number[],
  hasUser: boolean,
): { label: string; scoreText: string } {
  if (!hasUser || moodWeek.length === 0) return { label: '0', scoreText: '' };
  const recorded = moodWeek.filter((value) => value > 0);
  if (recorded.length === 0) return { label: '0', scoreText: '' };
  const average = recorded.reduce((sum, value) => sum + value, 0) / recorded.length;
  const label = average >= 3.5 ? 'Great' : average >= 3 ? 'Good' : average >= 2 ? 'Okay' : 'Low';
  return { label, scoreText: ` (${average.toFixed(1)}/4)` };
}

/** Web weekday labels for the mood chart. */
export const MOOD_WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export type ReportStats = { workouts?: number; journal?: number; dadDates?: number };

/** Port of web `getReportStatsList` — `0` for anything missing. */
export function getReportStatsList(
  reportStats: ReportStats | null | undefined,
): ReadonlyArray<readonly [string, string]> {
  if (!reportStats) {
    return [['0', 'Workouts'], ['0', 'Journal'], ['0', 'Dad dates']] as const;
  }
  return [
    [String(reportStats.workouts ?? 0), 'Workouts'],
    [String(reportStats.journal ?? 0), 'Journal'],
    [String(reportStats.dadDates ?? 0), 'Dad dates'],
  ] as const;
}
