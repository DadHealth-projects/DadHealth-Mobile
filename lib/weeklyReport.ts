/**
 * Weekly Dad Health report — brief Change 04, Moment 5 (checklist item 17).
 *
 * The report is a Pro feature that lands every Sunday: the week-on-week
 * movement of each pillar, one sentence on what happened, and one line on where
 * to put next week. Free members see the same structure as a locked preview, so
 * nothing is blocked without showing what is behind it.
 *
 * Every sentence is derived from the dad's own numbers. Nothing is invented —
 * when there is no week-on-week data yet the report is `null` and the surface
 * says so instead of inferring progress.
 */

export type WeeklyReportPillar = {
  label: 'Mind' | 'Body' | 'Bond';
  /** Week-on-week change in score points, already rounded. `null` = no data. */
  change: number | null;
};

export type WeeklyReport = {
  pillars: WeeklyReportPillar[];
  summary: string;
  nextWeek: string;
};

export type WeeklyReportSource = {
  mindWeekChange: number | null;
  bodyWeekChange: number | null;
  bondWeekChange: number | null;
  monthWorkouts: number;
};

/** Where next week's effort goes, per pillar. */
const FOCUS_AREA: Record<WeeklyReportPillar['label'], string> = {
  Mind: 'recovery',
  Body: 'movement',
  Bond: 'connection',
};

/** Four logged workouts in the month reads as a consistent training habit. */
const CONSISTENT_WORKOUTS = 4;

/** The brief specifies the report arrives every Sunday. */
export function isWeeklyReportDay(date: Date = new Date()): boolean {
  return date.getDay() === 0;
}

function roundedChange(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

export function buildWeeklyReport(source: WeeklyReportSource): WeeklyReport | null {
  const pillars: WeeklyReportPillar[] = [
    { label: 'Mind', change: roundedChange(source.mindWeekChange) },
    { label: 'Body', change: roundedChange(source.bodyWeekChange) },
    { label: 'Bond', change: roundedChange(source.bondWeekChange) },
  ];

  if (pillars.every((pillar) => pillar.change === null)) return null;

  const moved = pillars.filter(
    (pillar): pillar is WeeklyReportPillar & { change: number } => pillar.change !== null,
  );
  const risen = [...moved].filter((pillar) => pillar.change > 0).sort((a, b) => b.change - a.change);
  const fallen = [...moved].filter((pillar) => pillar.change < 0).sort((a, b) => a.change - b.change);

  const trainingClause = source.monthWorkouts >= CONSISTENT_WORKOUTS
    ? "You've been training consistently. "
    : '';

  let summary: string;
  if (fallen.length > 0 && risen.length > 0) {
    summary = `${trainingClause}You've kept your ${risen[0].label} score moving, but your ${fallen[0].label} score has dipped.`;
  } else if (fallen.length > 0) {
    summary = `${trainingClause}Your ${fallen[0].label} score has dipped this week.`;
  } else if (risen.length > 0) {
    summary = `${trainingClause}Every pillar you moved this week moved up — ${risen[0].label} most of all.`;
  } else {
    summary = `${trainingClause}Your scores held steady this week.`;
  }

  // Next week points at what fell; if nothing fell, at whatever moved least.
  const focusPillars = fallen.length > 0
    ? fallen.slice(0, 2)
    : [...moved].sort((a, b) => a.change - b.change).slice(0, 1);
  const areas = focusPillars.map((pillar) => FOCUS_AREA[pillar.label]);
  const nextWeek = `Next week: Focus on ${areas.length === 2 ? `${areas[0]} and ${areas[1]}` : areas[0]}.`;

  return { pillars, summary, nextWeek };
}

/** `↑ 8%` / `↓ 4%` / `—`, matching the brief's report formatting. */
export function formatPillarChange(change: number | null): string {
  if (change === null) return '—';
  if (change === 0) return '0%';
  return `${change > 0 ? '↑' : '↓'} ${Math.abs(change)}%`;
}
