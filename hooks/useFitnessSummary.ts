import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

type FitnessSummary = {
  latestLoggedDate: string | null;
  monthWorkouts: number;
  weightDisplay: string;
  stepsDisplay: string;
  activeDisplay: string;
};

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
        .select('metric_type,value,recorded_at')
        .eq('user_id', userId)
        .gte('recorded_at', start.toISOString().slice(0, 10))
        .order('recorded_at', { ascending: false }),
    ]);

    const workouts = workoutsResult.error ? [] : (workoutsResult.data ?? []);
    const metrics = metricsResult.error ? [] : (metricsResult.data ?? []);
    const now = new Date();
    const monthWorkouts = workouts.filter((workout) => {
      const performedAt = new Date(workout.performed_at);
      return performedAt.getMonth() === now.getMonth()
        && performedAt.getFullYear() === now.getFullYear();
    }).length;

    const weights = metrics.filter((metric) => metric.metric_type === 'weight');
    const latestWeight = weights[0]?.value;
    const previousWeight = weights[1]?.value;
    const steps = metrics.find((metric) => metric.metric_type === 'steps')?.value;
    const activeMinutes = metrics.find((metric) => metric.metric_type === 'active_mins')?.value;
    setData({
      latestLoggedDate: workouts[0]?.performed_at?.slice(0, 10) ?? null,
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
