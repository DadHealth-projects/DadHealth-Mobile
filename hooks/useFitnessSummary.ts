import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

type FitnessSummary = {
  latestLoggedDate: string | null;
  monthWorkouts: number;
  weightDisplay: string;
  stepsDisplay: string;
  activeDisplay: string;
};

type WorkoutRow = { performed_at: string };
type MetricRow = { metric_type: string; value: number; recorded_at: string; source?: string | null };

const EMPTY_SUMMARY: FitnessSummary = {
  latestLoggedDate: null,
  monthWorkouts: 0,
  weightDisplay: '0',
  stepsDisplay: '0',
  activeDisplay: '0 min',
};

export function useFitnessSummary(userId?: string) {
  const [data, setData] = useState<FitnessSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    setLoading(true);
    const start = new Date();
    start.setMonth(start.getMonth() - 1);

    const [workoutsResult, metricsResult] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('performed_at')
        .eq('user_id', userId)
        .gte('performed_at', start.toISOString().slice(0, 10))
        .order('performed_at', { ascending: false }),
      supabase
        .from('body_metrics')
        .select('metric_type,value,recorded_at,source')
        .eq('user_id', userId)
        .gte('recorded_at', start.toISOString().slice(0, 10))
        .order('recorded_at', { ascending: false }),
    ]);

    if (workoutsResult.error) console.warn('[FitnessSummary] Workout query failed.', workoutsResult.error);
    if (metricsResult.error) console.warn('[FitnessSummary] Body metrics query failed.', metricsResult.error);

    const workouts = (workoutsResult.error ? [] : (workoutsResult.data ?? [])) as WorkoutRow[];
    const metrics = (metricsResult.error ? [] : (metricsResult.data ?? [])) as MetricRow[];
    const now = new Date();
    const monthWorkouts = workouts.filter((workout) => {
      const performedAt = new Date(workout.performed_at);
      return performedAt.getMonth() === now.getMonth()
        && performedAt.getFullYear() === now.getFullYear();
    }).length;

    const weights = metrics.filter((metric) => metric.metric_type === 'weight');
    const latestWeight = weights[0]?.value;
    const previousWeight = weights[1]?.value;
    const today = localDateKey(new Date());
    const steps = metrics.find((metric) => metric.metric_type === 'steps')?.value;
    const activeMinutes = metrics.find(
      (metric) => metric.metric_type === 'active_mins' && metric.recorded_at.slice(0, 10) === today,
    )?.value;
    const latestLoggedAt = [workouts[0]?.performed_at, metrics[0]?.recorded_at]
      .filter((value): value is string => Boolean(value))
      .reduce<string | null>((latest, value) => {
        if (!latest) return value;
        return new Date(value).getTime() > new Date(latest).getTime() ? value : latest;
      }, null);

    console.info('[FitnessSummary] Refreshed.', {
      workoutRows: workouts.length,
      metricRows: metrics.length,
      latestLoggedDate: latestLoggedAt?.slice(0, 10) ?? null,
      latestStepsSource: metrics.find((metric) => metric.metric_type === 'steps')?.source ?? null,
      hasActiveMinutesToday: activeMinutes != null,
    });
    setData({
      latestLoggedDate: latestLoggedAt?.slice(0, 10) ?? null,
      monthWorkouts,
      weightDisplay: previousWeight != null && latestWeight != null
        ? `${previousWeight}→${latestWeight}kg`
        : '0',
      stepsDisplay: steps != null ? Number(steps).toLocaleString() : '0',
      activeDisplay: activeMinutes != null ? `${Math.round(Number(activeMinutes))} min` : '0 min',
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, refresh };
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
