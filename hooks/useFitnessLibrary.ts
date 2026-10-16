import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { supabase } from '../lib/supabase';
import { selectWeeklyWorkout } from '../lib/weeklyWorkoutSelection';

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

type WeeklyWorkoutAssignmentRow = {
  workout_id: string;
  week_start: string;
};

type FitnessLibrarySnapshot = {
  workouts: FitnessWorkout[];
  weeklyWorkout: FitnessWorkout | null;
  assignmentKnown: boolean;
  error: string | null;
};

const fitnessLibraryRequests = new Map<string, Promise<FitnessLibrarySnapshot>>();

async function fetchFitnessLibrary(userId?: string): Promise<FitnessLibrarySnapshot> {
  const adminQuery = supabase
    .from('workouts')
    .select('id,title,duration_mins,equipment,focus,exercises,source')
    .eq('source', 'admin')
    .order('created_at', { ascending: false });
  const assignmentQuery = supabase
    .from('free_weekly_workout_assignments')
    .select('week_start,workout_id')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [adminResult, generatedResult, assignmentResult] = await Promise.all([
    adminQuery,
    userId
      ? supabase
        .from('workouts')
        .select('id,title,duration_mins,equipment,focus,exercises,source')
        .eq('user_id', userId)
        .eq('source', 'ai_generated')
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    assignmentQuery,
  ]);

  if (adminResult.error || generatedResult.error) {
    return {
      workouts: [],
      weeklyWorkout: null,
      assignmentKnown: false,
      error: userId
        ? 'We could not load your workouts. Please try again.'
        : 'We could not load the workout library. Please try again.',
    };
  }

  const adminWorkouts = (adminResult.data ?? []) as FitnessWorkout[];
  const generatedWorkouts = (generatedResult.data ?? []) as FitnessWorkout[];
  const assignment = assignmentResult.data as WeeklyWorkoutAssignmentRow | null;
  return {
    workouts: [...generatedWorkouts, ...adminWorkouts],
    weeklyWorkout: selectWeeklyWorkout(adminWorkouts, assignment),
    assignmentKnown: !assignmentResult.error,
    error: assignmentResult.error ? 'We could not confirm this week’s Free workout. Please try again.' : null,
  };
}

async function loadFitnessLibrary(userId: string | undefined, forceFresh: boolean): Promise<FitnessLibrarySnapshot> {
  const key = userId ?? 'public';
  const activeRequest = fitnessLibraryRequests.get(key);
  if (activeRequest) {
    const activeResult = await activeRequest;
    if (!forceFresh) return activeResult;
    // Concurrent focus/resume refreshes join one follow-up request.
    const followUpRequest = fitnessLibraryRequests.get(key);
    if (followUpRequest) return followUpRequest;
  }

  let request: Promise<FitnessLibrarySnapshot>;
  request = fetchFitnessLibrary(userId).finally(() => {
    if (fitnessLibraryRequests.get(key) === request) fitnessLibraryRequests.delete(key);
  });
  fitnessLibraryRequests.set(key, request);
  return request;
}

export function useFitnessLibrary(userId?: string, enabled = true) {
  const { isOffline } = useNetworkStatus();
  const [workouts, setWorkouts] = useState<FitnessWorkout[]>([]);
  const [weeklyWorkout, setWeeklyWorkout] = useState<FitnessWorkout | null>(null);
  const [assignmentKnown, setAssignmentKnown] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const hasFocused = useRef(false);

  const load = useCallback(async (forceFresh: boolean) => {
    const requestId = ++latestRequest.current;
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (isOffline) {
      setLoading(false);
      setError(null);
      setAssignmentKnown(false);
      return;
    }

    setLoading(true);
    setError(null);
    setAssignmentKnown(false);
    setWeeklyWorkout(null);
    const result = await loadFitnessLibrary(userId, forceFresh);
    if (requestId !== latestRequest.current) return;
    setWorkouts(result.workouts);
    setWeeklyWorkout(result.weeklyWorkout);
    setAssignmentKnown(result.assignmentKnown);
    setError(result.error);
    setLoading(false);
  }, [enabled, isOffline, userId]);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useFocusEffect(useCallback(() => {
    if (!hasFocused.current) {
      hasFocused.current = true;
      return;
    }
    if (userId && !isOffline) void load(true);
  }, [isOffline, load, userId]));

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && previousState !== 'active' && userId) {
        if (!isOffline) void load(true);
        else latestRequest.current += 1;
      }
      previousState = nextState;
    });
    return () => {
      latestRequest.current += 1;
      subscription.remove();
    };
  }, [isOffline, load, userId]);

  return { workouts, weeklyWorkout, assignmentKnown, loading, error, refresh };
}
