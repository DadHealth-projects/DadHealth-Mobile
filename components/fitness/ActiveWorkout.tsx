import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { FitnessWorkout, FitnessWorkoutExercise } from '../../hooks/useFitnessLibrary';
import { DAD_STRENGTH_MOVES } from '../../lib/homeContent';
import { supabase } from '../../lib/supabase';
import LimeButton from '../LimeButton';
import SectionHeader from '../dashboard/SectionHeader';
import TagPill from '../dashboard/TagPill';

const TIMER_KEY = 'dadHealth_workout_timer';

type ActiveMove = {
  title: string;
  detail: string;
  tag: string;
};

function exerciseToMove(exercise: FitnessWorkoutExercise): ActiveMove {
  return {
    title: exercise.name ?? '',
    detail: `${exercise.sets} sets · ${exercise.reps_or_duration} · Rest ${exercise.rest_period}`,
    tag: exercise.muscle_group ?? '',
  };
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

type ActiveWorkoutProps = {
  userId?: string;
  workout: FitnessWorkout | null;
  onRequireAuth: () => void;
  onElapsedChange: (seconds: number) => void;
};

export default function ActiveWorkout({
  userId,
  workout,
  onRequireAuth,
  onElapsedChange,
}: ActiveWorkoutProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');

  const moves = useMemo<ActiveMove[]>(
    () => workout?.exercises.length
      ? workout.exercises.map(exerciseToMove)
      : DAD_STRENGTH_MOVES,
    [workout],
  );
  const currentMove = moves[currentExerciseIndex] ?? moves[0];

  useEffect(() => {
    setCurrentExerciseIndex(0);
    setMessage(null);
  }, [workout?.id]);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(TIMER_KEY).then((stored) => {
      if (!active || !stored) return;
      try {
        const parsed = JSON.parse(stored) as { seconds?: number; date?: string };
        const today = new Date().toISOString().slice(0, 10);
        if (parsed.date === today && typeof parsed.seconds === 'number') {
          setElapsedSeconds(parsed.seconds);
        }
      } catch {
        void SecureStore.deleteItemAsync(TIMER_KEY);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    onElapsedChange(elapsedSeconds);
    if (!running) return;
    void SecureStore.setItemAsync(TIMER_KEY, JSON.stringify({
      seconds: elapsedSeconds,
      date: new Date().toISOString().slice(0, 10),
    }));
  }, [elapsedSeconds, onElapsedChange, running]);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const handleToggleTimer = useCallback(() => {
    setMessage(null);
    if (!userId) {
      onRequireAuth();
      return;
    }
    setRunning((current) => !current);
  }, [onRequireAuth, userId]);

  const handleNextExercise = useCallback(() => {
    setMessage(null);
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (moves.length > 0) {
      setCurrentExerciseIndex((current) => (current + 1) % moves.length);
    }
  }, [moves.length, onRequireAuth, userId]);

  const handleLogSession = useCallback(async () => {
    setMessage(null);
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (!currentMove) return;

    setSaving(true);
    const durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    const sessionResult = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        exercise_name: currentMove.title || 'Dad Strength',
        duration_minutes: durationMinutes,
        calories: 0,
        performed_at: new Date().toISOString(),
      });

    if (sessionResult.error) {
      setMessageTone('error');
      setMessage(sessionResult.error.message);
      setSaving(false);
      return;
    }

    if (workout?.id) {
      const completionResult = await supabase.from('workout_completions').insert({
        user_id: userId,
        workout_id: workout.id,
        duration_actual_seconds: elapsedSeconds,
      });
      if (completionResult.error) {
        setMessageTone('error');
        setMessage(`Session logged, but workout completion could not be saved: ${completionResult.error.message}`);
        setSaving(false);
        setCurrentExerciseIndex((current) => (current + 1) % moves.length);
        return;
      }
    }

    const nextIndex = (currentExerciseIndex + 1) % moves.length;
    const nextMove = moves[nextIndex];
    setMessageTone('success');
    setMessage(nextMove ? `Session logged. Next: ${nextMove.title}.` : 'Session logged.');
    setCurrentExerciseIndex(nextIndex);
    setSaving(false);
  }, [currentExerciseIndex, currentMove, elapsedSeconds, moves, onRequireAuth, userId, workout?.id]);

  return (
    <View className="gap-lg">
      <View>
        <Text className="font-heading text-white text-[52px] leading-[52px]">
          {formatTime(elapsedSeconds)}
        </Text>
        <Text className="font-heading-semibold text-white/40 text-[11px] tracking-[1px] uppercase mt-xs">
          Workout timer · {moves.length} moves
        </Text>
        <View className="gap-sm mt-md">
          <LimeButton label={`${running ? 'Pause' : 'Start'} →`} onPress={handleToggleTimer} />
          <View className="flex-row gap-sm">
            <Pressable
              onPress={handleNextExercise}
              accessibilityRole="button"
              accessibilityLabel="Next exercise"
              className="flex-1 min-h-[48px] rounded-button border border-white/25 items-center justify-center active:opacity-70"
            >
              <Text className="font-heading-bold text-white text-[12px] tracking-[1px] uppercase">
                Next exercise
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleLogSession()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Log session"
              className="flex-1 min-h-[48px] rounded-button border border-white/25 items-center justify-center active:opacity-70 disabled:opacity-40"
            >
              <Text className="font-heading-bold text-white text-[12px] tracking-[1px] uppercase">
                {saving ? 'Saving...' : 'Log session →'}
              </Text>
            </Pressable>
          </View>
        </View>
        {message ? (
          <View
            accessibilityRole="alert"
            className={`rounded-button border p-md mt-md ${
              messageTone === 'success' ? 'border-lime/40 bg-lime/10' : 'border-red-400/40 bg-red-400/10'
            }`}
          >
            <Text
              className={`font-heading-bold text-[13px] tracking-[0.5px] uppercase ${
                messageTone === 'success' ? 'text-lime' : 'text-red-300'
              }`}
            >
              {message}
            </Text>
          </View>
        ) : null}
      </View>

      <View>
        <SectionHeader title="Today's moves" className="mb-sm" />
        <View className="gap-sm">
          {moves.map((move, index) => {
            const current = index === currentExerciseIndex;
            return (
              <View
                key={`${move.title}-${index}`}
                className={`flex-row items-center gap-md p-md rounded-card border ${
                  current ? 'bg-lime/10 border-lime' : 'bg-card border-border'
                }`}
              >
                <View className="h-[28px] w-[28px] bg-lime/10 items-center justify-center">
                  <Text className="font-heading text-lime text-[13px]">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-heading-bold text-white text-[15px] tracking-[0.5px] uppercase">
                    {move.title}
                  </Text>
                  <Text className="font-body text-white/40 text-[11px] mt-xs">{move.detail}</Text>
                </View>
                {move.tag ? <TagPill label={move.tag} /> : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
