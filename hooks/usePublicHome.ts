import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import { DAD_STRENGTH_MOVES, type DadStrengthMove } from '../lib/homeContent';

export type PublicHomeData = {
  /** "N dads in community" — same count the web landing page shows. */
  dadsCount: number;
  /** Latest admin workout title, or null → the "DAD STRENGTH" fallback. */
  workoutTitle: string | null;
  /** Today's moves: the real workout's exercises, else the web's default set. */
  moves: DadStrengthMove[];
};

type WorkoutExercise = {
  name?: string;
  sets?: number | string;
  reps_or_duration?: string;
  rest_period?: string;
  muscle_group?: string;
};

/** Same shape as web `mapExerciseToMove` in DadStrengthSection.tsx. */
function mapExerciseToMove(exercise: WorkoutExercise): DadStrengthMove {
  return {
    title: exercise.name ?? '',
    detail: `${exercise.sets} sets · ${exercise.reps_or_duration} · Rest ${exercise.rest_period}`,
    tag: exercise.muscle_group ?? '',
  };
}

/**
 * Public (logged-out) Home data. Mirrors what the web landing page reads without
 * a session: the community count and the newest admin workout used by the
 * "Today's workout" section. Everything is optional — if a policy blocks a read
 * the section falls back to the same defaults the web uses.
 */
export function usePublicHome() {
  const [data, setData] = useState<PublicHomeData>({
    dadsCount: 0,
    workoutTitle: null,
    moves: DAD_STRENGTH_MOVES,
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (showRefreshIndicator: boolean) => {
    if (showRefreshIndicator) setLoading(true);
    try {
      const [countResult, workoutResult] = await Promise.all([
        supabase.from('user_profile').select('id', { count: 'exact', head: true }),
        supabase
          .from('workouts')
          .select('title,exercises')
          .eq('source', 'admin')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const workout = workoutResult.error ? null : workoutResult.data;
      const exercises = Array.isArray(workout?.exercises) ? (workout.exercises as WorkoutExercise[]) : [];

      setData({
        dadsCount: countResult.error ? 0 : (countResult.count ?? 0),
        workoutTitle: typeof workout?.title === 'string' && workout.title.trim().length > 0
          ? workout.title.trim()
          : null,
        moves: exercises.length > 0 ? exercises.map(mapExerciseToMove) : DAD_STRENGTH_MOVES,
      });
    } catch {
      // The public Home already has complete fallback content.
    } finally {
      if (showRefreshIndicator) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return { data, loading, refresh };
}
