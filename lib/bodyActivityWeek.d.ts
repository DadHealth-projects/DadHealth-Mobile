export type BodyWorkoutDay = {
  performed_at: string;
  duration_minutes: number | null;
  exercise_name?: string | null;
};

export type ManualBodyActivityDay = {
  activity_date: string;
  activity_type: string;
  other_activity_text?: string | null;
  duration_minutes: number | null;
};

export function buildBodyWeekSeries(
  dayKeys: string[],
  workouts?: BodyWorkoutDay[],
  manualLogs?: ManualBodyActivityDay[],
): number[];

export function latestBodyActivityDate(
  workouts?: Array<{ performed_at: string }>,
  manualLogs?: Array<{ activity_date: string }>,
  metrics?: Array<{ recorded_at: string }>,
): string | null;
