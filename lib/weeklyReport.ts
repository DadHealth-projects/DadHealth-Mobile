import { formatScoreTrend } from './scoreTrends';

/**
 * Weekly Dad Health report — brief Change 04, Moment 5 (checklist item 17).
 *
 * The report is a Pro feature that lands every Sunday: the week-on-week
 * movement of each pillar, one sentence on what happened, and one line on where
 * to put next week. Free members see the same structure as a locked preview, so
 * nothing is blocked without showing what is behind it.
 *
 * Every sentence is derived from the dad's own numbers. Nothing is invented —
 * when there is no week-on-week data yet the score remains visible with a
 * neutral arrow and no fabricated change amount.
 */

export type WeeklyReportPillar = {
  label: 'Mind' | 'Body' | 'Bond';
  score: number;
  /** Week-on-week change in score points, already rounded. `null` = no data. */
  change: number | null;
};

export type WeeklyReport = {
  pillars: WeeklyReportPillar[];
  summary: string;
  nextWeek: string;
};

export type WeeklyReportSource = {
  mindScore: number | null;
  bodyScore: number | null;
  bondScore: number | null;
  mindWeekChange: number | null;
  bodyWeekChange: number | null;
  bondWeekChange: number | null;
  monthWorkouts: number;
  recommendedAction?: 'checkin' | 'mind_breathing' | 'body_workout' | 'bond_present_mode' | null;
};

const ACTION_FOCUS = {
  checkin: 'Check in with yourself',
  mind_breathing: 'Take a two-minute Mind reset',
  body_workout: 'Move your body',
  bond_present_mode: 'Make time to connect',
} as const;

/** Four logged workouts in the month reads as a consistent training habit. */
const CONSISTENT_WORKOUTS = 4;

/** The brief specifies the report arrives every Sunday. */
export function isWeeklyReportDay(date: Date = new Date()): boolean {
  return date.getDay() === 0 && date.getHours() >= 8;
}

function roundedChange(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

export function buildWeeklyReport(source: WeeklyReportSource): WeeklyReport | null {
  const pillars: WeeklyReportPillar[] = [
    { label: 'Mind', score: Math.round(source.mindScore ?? 0), change: roundedChange(source.mindWeekChange) },
    { label: 'Body', score: Math.round(source.bodyScore ?? 0), change: roundedChange(source.bodyWeekChange) },
    { label: 'Bond', score: Math.round(source.bondScore ?? 0), change: roundedChange(source.bondWeekChange) },
  ];

  const moved = pillars.filter(
    (pillar): pillar is WeeklyReportPillar & { change: number } => pillar.change !== null,
  );
  const risen = [...moved].filter((pillar) => pillar.change > 0).sort((a, b) => b.change - a.change);
  const fallen = [...moved].filter((pillar) => pillar.change < 0).sort((a, b) => a.change - b.change);

  const trainingClause = source.monthWorkouts >= CONSISTENT_WORKOUTS
    ? "You've been training consistently. "
    : '';

  let summary: string;
  if (moved.length === 0) {
    summary = 'Your scores are here. Week-on-week trends will appear when previous-week data is available.';
  } else if (fallen.length > 0 && risen.length > 0) {
    summary = `${trainingClause}You've kept your ${risen[0].label} score moving, but your ${fallen[0].label} score has dipped.`;
  } else if (fallen.length > 0) {
    summary = `${trainingClause}Your ${fallen[0].label} score has dipped this week.`;
  } else if (risen.length > 0) {
    summary = `${trainingClause}Every pillar you moved this week moved up — ${risen[0].label} most of all.`;
  } else {
    summary = `${trainingClause}Your scores held steady this week.`;
  }

  const nextWeek = source.recommendedAction
    ? `Next week: ${ACTION_FOCUS[source.recommendedAction]}.`
    : 'Next week: Choose one small action that supports your wellbeing.';

  return { pillars, summary, nextWeek };
}

/** Format positive, negative, zero, and missing canonical weekly changes. */
export function formatPillarChange(change: number | null): string {
  const trend = formatScoreTrend(change);
  return trend.change === null ? trend.arrow : `${trend.arrow} ${trend.change} pts`;
}
