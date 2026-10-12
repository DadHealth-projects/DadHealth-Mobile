import { useCallback, useEffect, useRef, useState } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { subscribeManualActivityChanges } from '../lib/manualActivities';
import { latestBodyActivityDate } from '../lib/bodyActivityWeek';
import { supabase } from '../lib/supabase';

type FitnessSummary = {
  latestLoggedDate: string | null;
  monthWorkouts: number;
  weightDisplay: string | null;
  stepsDisplay: string | null;
  activeDisplay: string | null;
};

type WorkoutRow = { performed_at: string };
type MetricRow = { metric_type: string; value: number; recorded_at: string; source?: string | null };
type ManualBodyActivityRow = { activity_date: string };

const EMPTY_SUMMARY: FitnessSummary = {
  latestLoggedDate: null,
  monthWorkouts: 0,
  weightDisplay: null,
  stepsDisplay: null,
  activeDisplay: null,
};

export function useFitnessSummary(userId?: string) {
  const { isOffline } = useNetworkStatus();
  const [data, setData] = useState<FitnessSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(Boolean(userId));
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      refreshGeneration.current += 1;
      setData(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }
    if (isOffline) {
      refreshGeneration.current += 1;
      setLoading(false);
      return;
    }

    const generation = ++refreshGeneration.current;
    setLoading(true);
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const startDate = localDateKey(start);
    const today = localDateKey(new Date());

    const [workoutsResult, metricsResult, manualActivitiesResult] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('performed_at')
        .eq('user_id', userId)
        .gte('performed_at', new Date(start.getFullYear(), start.getMonth(), start.getDate()).toISOString())
        .order('performed_at', { ascending: false }),
      supabase
        .from('body_metrics')
        .select('metric_type,value,recorded_at,source')
        .eq('user_id', userId)
        .gte('recorded_at', new Date(start.getFullYear(), start.getMonth(), start.getDate()).toISOString())
        .order('recorded_at', { ascending: false }),
      supabase
        .from('activity_logs')
        .select('activity_date')
        .eq('user_id', userId)
        .eq('pillar', 'body')
        .gte('activity_date', startDate)
        .lte('activity_date', today)
        .order('activity_date', { ascending: false }),
    ]);

    if (generation !== refreshGeneration.current) return;

    const workouts = (workoutsResult.error ? [] : (workoutsResult.data ?? [])) as WorkoutRow[];
    const metrics = (metricsResult.error ? [] : (metricsResult.data ?? [])) as MetricRow[];
    const manualActivities = (manualActivitiesResult.error ? [] : (manualActivitiesResult.data ?? [])) as ManualBodyActivityRow[];
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
    const activeMinutes = metrics.find(
      (metric) => metric.metric_type === 'active_mins' && metric.recorded_at.slice(0, 10) === today,
    )?.value;
    const latestLoggedDate = latestBodyActivityDate(workouts, manualActivities, metrics);

    setData({
      latestLoggedDate,
      monthWorkouts,
      weightDisplay: previousWeight != null && latestWeight != null
        ? `${previousWeight}→${latestWeight}kg`
        : latestWeight != null
          ? `${latestWeight}kg`
          : null,
      stepsDisplay: steps != null ? Number(steps).toLocaleString() : null,
      activeDisplay: activeMinutes != null ? `${Math.round(Number(activeMinutes))} min` : null,
    });
    if (generation === refreshGeneration.current) setLoading(false);
  }, [isOffline, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeManualActivityChanges(() => { void refresh(); }), [refresh]);

  return { data, loading, refresh };
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
