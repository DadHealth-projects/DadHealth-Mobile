function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizedActivityName(value) {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
}

function activitySignature(day, name, duration) {
  const normalizedName = normalizedActivityName(name);
  return normalizedName && Number.isFinite(duration)
    ? `${day}|${normalizedName}|${duration}`
    : null;
}

function minutesToBucket(minutes) {
  if (minutes >= 40) return 4;
  if (minutes >= 25) return 3;
  if (minutes >= 10) return 2;
  if (minutes > 0) return 1;
  return 0;
}

/**
 * Combine current Monday–Sunday Body chart sources. Exact same-day, same-name,
 * same-duration cross-source entries count once; distinct logs remain visible.
 */
exports.buildBodyWeekSeries = function buildBodyWeekSeries(dayKeys, workouts = [], manualLogs = []) {
  const validDays = new Set(dayKeys);
  const totals = new Map(dayKeys.map((day) => [day, 0]));
  const workoutSignatures = new Map();

  for (const workout of workouts) {
    const day = localDateKey(workout.performed_at);
    if (!day || !validDays.has(day)) continue;
    const duration = Number(workout.duration_minutes) || 0;
    totals.set(day, totals.get(day) + duration);
    const signature = activitySignature(day, workout.exercise_name, duration);
    if (signature) workoutSignatures.set(signature, (workoutSignatures.get(signature) ?? 0) + 1);
  }

  for (const activity of manualLogs) {
    const day = activity.activity_date;
    if (!validDays.has(day)) continue;
    const duration = Number(activity.duration_minutes) || 0;
    const name = activity.activity_type === 'other'
      ? activity.other_activity_text || activity.activity_type
      : activity.activity_type;
    const signature = activitySignature(day, name, duration);
    const duplicateCount = signature ? workoutSignatures.get(signature) ?? 0 : 0;
    if (duplicateCount > 0) {
      workoutSignatures.set(signature, duplicateCount - 1);
      continue;
    }
    totals.set(day, totals.get(day) + duration);
  }

  return dayKeys.map((day) => minutesToBucket(totals.get(day) ?? 0));
};

/** Keep date-only activity_date values out of UTC timestamp conversion. */
exports.latestBodyActivityDate = function latestBodyActivityDate(workouts = [], manualLogs = [], metrics = []) {
  const dates = [
    ...workouts.map((row) => localDateKey(row.performed_at)),
    ...metrics.map((row) => localDateKey(row.recorded_at)),
    ...manualLogs.map((row) => typeof row.activity_date === 'string' ? row.activity_date : null),
  ].filter(Boolean);
  dates.sort();
  return dates[dates.length - 1] ?? null;
};
