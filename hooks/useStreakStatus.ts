import { useItem02Resource } from './useWeeklyReport';

export type LiveStreakStatus = {
  state: 'current' | 'pending' | 'scheduled'; count: number | null; lastKnownCount: number | null;
  reconciledThrough: string | null; allowance: number | null; protectedDates: string[];
  calendarDays: string[]; currentDate: string | null;
};
export function parseStreakStatus(value: unknown): LiveStreakStatus {
  const row = (value as { streak?: LiveStreakStatus })?.streak;
  const date = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!row || !['current','pending','scheduled'].includes(row.state)
    || (row.state === 'current' ? !Number.isSafeInteger(row.count) || row.count! < 0 : row.count !== null)
    || !Array.isArray(row.protectedDates) || !row.protectedDates.every(date)
    || !Array.isArray(row.calendarDays) || row.calendarDays.length !== 7 || !row.calendarDays.every(date)
    || !date(row.currentDate) || ![null,0,1].includes(row.allowance)) throw new Error('Streak unavailable');
  return { state: row.state, count: row.count, lastKnownCount: row.lastKnownCount,
    reconciledThrough: row.reconciledThrough, allowance: row.allowance,
    protectedDates: [...row.protectedDates], calendarDays: [...row.calendarDays], currentDate: row.currentDate };
}
export function useStreakStatus(owner: string | undefined) {
  return useItem02Resource(owner, '/api/streaks', 'streak', parseStreakStatus, Boolean(owner));
}
