import { useCallback, useEffect, useState } from 'react';

import { isProfilePro } from '../lib/proStatus';
import { supabase } from '../lib/supabase';

export type FitnessWorkoutExercise = {
  name?: string;
  sets?: number | string;
  reps_or_duration?: string;
  rest_period?: string;
  muscle_group?: string;
  beginner_modification?: string;
};

export type FitnessWorkout = {
  id: string;
  title: string;
  duration_mins: number;
  equipment: 'none' | 'dumbbells' | 'full_gym';
  focus: 'full_body' | 'upper' | 'lower' | 'core';
  exercises: FitnessWorkoutExercise[];
  source: 'admin' | 'ai_generated';
};

export function useFitnessLibrary(userId?: string, enabled = true) {
  const [workouts, setWorkouts] = useState<FitnessWorkout[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [proError, setProError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setProError(null);
    const adminQuery = supabase
      .from('workouts')
      .select('id,title,duration_mins,equipment,focus,exercises,source')
      .eq('source', 'admin')
      .order('created_at', { ascending: false })
      .limit(8);

    if (!userId) {
      const adminResult = await adminQuery;
      if (adminResult.error) {
        setWorkouts([]);
        setError(adminResult.error.message);
      } else {
        setWorkouts((adminResult.data ?? []) as FitnessWorkout[]);
      }
      setIsPro(false);
      setProError(null);
      setLoading(false);
      return;
    }

    const [adminResult, generatedResult, profileResult] = await Promise.all([
      adminQuery,
      supabase
        .from('workouts')
        .select('id,title,duration_mins,equipment,focus,exercises,source')
        .eq('user_id', userId)
        .eq('source', 'ai_generated')
        .order('created_at', { ascending: false }),
      supabase
        .from('user_profile')
        .select('is_pro,subscription_status')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (adminResult.error || generatedResult.error) {
      setWorkouts([]);
      setError(adminResult.error?.message ?? generatedResult.error?.message ?? 'Unable to load workouts.');
      setLoading(false);
      return;
    }

    const pro = isProfilePro(profileResult.data);
    const adminWorkouts = (adminResult.data ?? []) as FitnessWorkout[];
    const generatedWorkouts = (generatedResult.data ?? []) as FitnessWorkout[];
    setProError(profileResult.error ? 'Unable to confirm Dad Health Pro access.' : null);
    setIsPro(profileResult.error ? false : pro);
    setWorkouts(!profileResult.error && pro ? [...generatedWorkouts, ...adminWorkouts] : adminWorkouts);
    setLoading(false);
  }, [enabled, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { workouts, isPro, loading, error, proError, refresh };
}
