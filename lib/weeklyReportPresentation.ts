import type { SavedMeasurement, SavedWeeklyReport } from './weeklyReport';

export const TREND_FALLBACK = 'Building first 7 day trend';
export const displayReportValue = (value?: SavedMeasurement) =>
  value?.state === 'available' ? String(Math.round(value.value)) : '—';

const points = (n: number) => `${n} point${n === 1 ? '' : 's'}`;

/** Empty string means show nothing. */
export function reportChange(report: SavedWeeklyReport, change?: SavedMeasurement): string {
  if (!report.comparisonAvailable || change?.state !== 'available') return '';
  const n = change.value, rounded = Math.round(Math.abs(n));
  if (n !== 0 && rounded === 0) return n > 0 ? '↑ Edged up' : '↓ Edged down';
  return `${n > 0 ? '↑ ' : n < 0 ? '↓ ' : ''}${rounded} pts`;
}

export const hasReportChanges = (report: SavedWeeklyReport) =>
  report.comparisonAvailable && report.pillars.some(p => p.change.state === 'available');

export const reportStreakLabel = (value?: SavedMeasurement) =>
  value?.state === 'available' ? `${Math.round(value.value)}-day streak` : 'Streak';

export function reportHeadline(report: SavedWeeklyReport): { title: string; body?: string } {
  if (report.pillars.length !== 3 || report.pillars.some(p => p.score.state !== 'available')) {
    return { title: 'Your week, Dad.' };
  }
  if (!report.comparisonAvailable) {
    if (report.comparisonReason === 'model_mismatch') return { title: 'A fresh starting point, Dad.',
      body: 'Your scores use the updated scoring model this week.' };
    if (['missing_history', 'incomplete_history'].includes(report.comparisonReason ?? '')
      || report.pillars.some(p => p.trendMessage === TREND_FALLBACK)) {
      return { title: 'Your week is ready, Dad.', body: TREND_FALLBACK };
    }
    return { title: 'Your week is ready, Dad.' };
  }
  if (report.pillars.some(p => p.change.state !== 'available')) return { title: 'Your week is ready, Dad.' };
  const changes = report.pillars.map(p => ({ name: p.name, value: p.change.state === 'available' ? p.change.value : 0 }));
  const rising = changes.filter(p => p.value > 0), falling = changes.filter(p => p.value < 0);
  if (rising.length && falling.length) return { title: 'Some scores rose, others dipped, Dad.' };
  if (falling.length) return { title: 'Your scores dipped, Dad. It happens.' };
  if (!rising.length) return { title: 'Your scores held steady, Dad.' };
    const largest = Math.max(...rising.map(p => p.value));
  const leaders = rising.filter(p => p.value === largest);
  if (Math.round(largest) < 1) return { title: 'Your scores edged up, Dad.' };
  return leaders.length === 1 ? { title: `${leaders[0].name} led the way, Dad.`,
    body: `${leaders[0].name} rose ${points(Math.round(largest))}.` } : { title: 'Your scores moved forward, Dad.' };
}

export function overallReportChange(report: SavedWeeklyReport): string | null {
  if (!report.comparisonAvailable || report.overallChange?.state !== 'available') return null;
  const change = report.overallChange.value;
    return change > 0 ? `Up ${points(Math.round(change))} on last week`
    : change < 0 ? `Down ${points(Math.round(Math.abs(change)))}` : 'Held steady';
}

export type ReportFocusPillar = 'mind' | 'body' | 'bond';
const focusCopy = {
  mind: { title: 'Five minutes for your head', button: 'Open Mind Reset' },
  body: { title: 'Ten minutes for your body', button: 'Open workout library' },
  bond: { title: 'Make time to connect', button: 'Open Present Dad Mode' },
};
export function reportFocus(report: SavedWeeklyReport) {
  if (report.access !== 'pro' || !report.details?.focus) return null;
  const pillar = report.details.focus.pillar as ReportFocusPillar;
  if (!(pillar in focusCopy)) return null;
  const ordered = (['Mind', 'Body', 'Bond'] as const).map(name => report.pillars.find(p => p.name === name));
  if (ordered.some(p => p?.score.state !== 'available')) return null;
  const lowest = Math.min(...ordered.map(p => p!.score.state === 'available' ? p!.score.value : Infinity));
  const tied = ordered.filter(p => p!.score.state === 'available' && p!.score.value === lowest);
  // Only present the saved focus when it agrees with the approved tie priority.
  if (tied[0]!.name.toLowerCase() !== pillar) return null;
  const saved = tied[0]!;
  const area = saved.name;
  const change = report.comparisonAvailable && saved.change.state === 'available' ? saved.change.value : null;
  const explanation = tied.length > 1 || change === null
    ? `${area} is your focus for next week. Choose one manageable session.`
    : change < 0 ? `${area} was your lowest score and fell this week. Choose one manageable session.`
    : change > 0 ? `${area} improved. Give it a little attention next week.`
    : `Give ${area} a little attention next week.`;
  return { pillar, ...focusCopy[pillar], explanation };
}

export function reportActivity(value: SavedMeasurement, singular: string, plural: string) {
  return `${displayReportValue(value)} ${value.state === 'available' && value.value === 1 ? singular : plural}`;
}
export function reportProtection(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  return `${weekday} was covered by your weekly streak freeze.`;
}

/** Native dismissal consumes a queued action once; an obsolete owner cannot use it. */
export function createReportFocusGate(owner: string) {
  let pending: ReportFocusPillar | null = null;
  let active = true;
  return {
    queue(currentOwner: string, pillar: ReportFocusPillar) {
      if (!active || currentOwner !== owner || pending) return false;
      pending = pillar;
      return true;
    },
    take(currentOwner: string) {
      const result = active && currentOwner === owner ? pending : null;
      pending = null;
      return result;
    },
    cancel() { active = false; pending = null; },
  };
}
