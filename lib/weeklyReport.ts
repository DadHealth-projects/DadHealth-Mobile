import { formatScoreTrend } from './scoreTrends';

/**
 * Weekly Dad Health report presentation contract.
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
  mind_breathing: 'Take a five-minute Mind Reset',
  body_workout: 'Move your body',
  bond_present_mode: 'Make time to connect',
} as const;

/** Four logged workouts in the month reads as a consistent training habit. */
const CONSISTENT_WORKOUTS = 4;

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

// Saved Phase A/V2 data; the legacy builder above is never used for these reads.
export type SavedMeasurement = { state: 'available'; value: number } | { state: 'missing' | 'unavailable' };
export type SavedWeeklyReport = {
  access: 'free' | 'pro'; weekStart: string; weekEndExclusive: string; comparisonAvailable: boolean;
  totalScore?: SavedMeasurement;
  overallChange?: SavedMeasurement;
  comparisonReason?: string;
  pillars: { name: 'Mind' | 'Body' | 'Bond'; score: SavedMeasurement; change: SavedMeasurement; trendMessage: string | null }[];
  details?: { workouts: SavedMeasurement; bondSessions: SavedMeasurement; checkins: SavedMeasurement;
    streak: { days: SavedMeasurement; protectedDates: string[] };
    focus: { pillar: string; action: string; text: string } | null };
};
export function isReportWeek(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}
export function reportDates(start: string, endExclusive: string): string {
  const format = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${format(new Date(`${start}T00:00:00Z`))} – ${format(new Date(Date.parse(`${endExclusive}T00:00:00Z`) - 86400000))}`;
}
export function savedChange(pillar: SavedWeeklyReport['pillars'][number], comparable: boolean): string {
  if (!comparable || pillar.change.state !== 'available') return pillar.trendMessage ?? 'Comparison unavailable';
  const value = pillar.change.value;
  return `${value > 0 ? '↑ ' : value < 0 ? '↓ ' : ''}${Math.abs(value)} pts`;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid report');
  return value as Record<string, unknown>;
}
function savedMeasurement(value: unknown): SavedMeasurement {
  const row = record(value);
  if (row.state === 'missing' || row.state === 'unavailable') return { state: row.state };
  if (row.state !== 'available' || typeof row.value !== 'number' || !Number.isFinite(row.value)) throw new Error('Invalid measurement');
  return { state: 'available', value: row.value };
}
export function parseSavedReport(value: unknown): SavedWeeklyReport {
  const envelope = record(value), report = record(envelope.report), period = record(report.period);
  if (envelope.state !== 'available' || !['free', 'pro'].includes(String(envelope.access)) || report.version !== 2
    || !isReportWeek(period.weekStart) || !isReportWeek(period.weekEndExclusive)
    || Date.parse(period.weekEndExclusive) - Date.parse(period.weekStart) !== 7 * 86400000) throw new Error('Invalid saved report');
  const pillars = record(report.pillars);
  const result: SavedWeeklyReport = { access: envelope.access as 'free' | 'pro', weekStart: period.weekStart,
    weekEndExclusive: period.weekEndExclusive,
    comparisonAvailable: record(report.comparison).state === 'available',
    comparisonReason: typeof record(report.comparison).reason === 'string' ? record(report.comparison).reason as string : undefined,
    overallChange: report.overallChange === undefined ? { state: 'unavailable' } : savedMeasurement(report.overallChange),
    totalScore: report.totalScore === undefined
      ? { state: 'unavailable' }
      : savedMeasurement(report.totalScore),
    pillars: (['Mind', 'Body', 'Bond'] as const).map(name => {
      const p = record(pillars[name.toLowerCase()]);
      return { name, score: savedMeasurement(p.score), change: savedMeasurement(p.changePoints),
        trendMessage: p.trendMessage === 'Building first 7 day trend' ? p.trendMessage : null };
    }) };
  if (
    result.overallChange?.state === 'available' &&
    (!Number.isInteger(result.overallChange.value) || Math.abs(result.overallChange.value) > 100)
  ) throw new Error('Invalid overall change');
  if (
    result.totalScore?.state === 'available' &&
    (
      !Number.isInteger(result.totalScore.value) ||
      result.totalScore.value < 0 ||
      result.totalScore.value > 100
    )
  ) {
    throw new Error('Invalid overall score');
  }

  if (result.access === 'pro') {
    const d = record(report.details), streak = record(d.streak);
    if (!Array.isArray(streak.protectedDates) || !streak.protectedDates.every(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('Invalid protected dates');
    const focus = d.focus == null ? null : record(d.focus);
    if (focus && (!['mind','body','bond'].includes(String(focus.pillar)) || typeof focus.action !== 'string' || typeof focus.text !== 'string')) throw new Error('Invalid focus');
    result.details = { workouts: savedMeasurement(d.workouts), bondSessions: savedMeasurement(d.bondSessions),
      checkins: savedMeasurement(d.checkins), streak: { days: savedMeasurement(streak.days), protectedDates: [...streak.protectedDates] as string[] },
      focus: focus ? { pillar: focus.pillar as string, action: focus.action as string, text: focus.text as string } : null };
  }
  return result;
}
export class Item02ReadError extends Error {
  constructor(public reason: string) { super('Information unavailable'); }
}
