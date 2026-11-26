import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { readOwnerSecret, writeOwnerSecret } from '../../lib/accountPrivacyCleanup';

import type { FitnessWorkout, FitnessWorkoutExercise } from '../../hooks/useFitnessLibrary';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { DAD_STRENGTH_MOVES } from '../../lib/homeContent';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../lib/supabase';
import { refreshDashboardForUser } from '../../hooks/useDashboard';
import LimeButton from '../LimeButton';
import InlineFormError from '../InlineFormError';
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

function formatMoveCount(count: number): string {
  return `${count} ${count === 1 ? 'move' : 'moves'}`;
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
  const currentOwner = useRef(userId); currentOwner.current = userId;
  const hydrated = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  // One id per logged session, kept until the whole save succeeds. A retry after a lost
  // response or a failed completion re-sends the same id, so the Body score never counts
  // one workout twice (canonical scoring adds 8 points per workout_sessions row).
  const pendingSession = useRef<{ owner: string; id: string } | null>(null);
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
    if (!message || messageTone !== 'success') return undefined;
    const timeout = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [message, messageTone]);

  useEffect(() => {
    let active = true;
    hydrated.current = false;
    setElapsedSeconds(0); setRunning(false); setSaving(false); setMessage(null);
    if (!userId) return;
    const valid = () => active && currentOwner.current === userId;
    // Never attribute the old ownerless TIMER_KEY to the next signed-in account.
    void readOwnerSecret(userId, `${TIMER_KEY}.${userId}`, valid).then((stored) => {
      if (!valid()) return;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.owner === userId && parsed.date === new Date().toISOString().slice(0, 10)
            && typeof parsed.seconds === 'number' && Number.isFinite(parsed.seconds)) setElapsedSeconds(parsed.seconds);
        } catch { /* Ignore an invalid owner-scoped timer. */ }
      }
      hydrated.current = true;
    }).catch(() => { if (valid()) hydrated.current = true; });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    onElapsedChange(elapsedSeconds);
    if (!running || !userId || !hydrated.current) return;
    void writeOwnerSecret(userId, `${TIMER_KEY}.${userId}`, JSON.stringify({
      owner: userId, seconds: elapsedSeconds, date: new Date().toISOString().slice(0, 10),
    }), () => mounted.current && currentOwner.current === userId).catch(() => undefined);
  }, [elapsedSeconds, onElapsedChange, running, userId]);

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
    if (isOffline) { showOfflineAction('workout_log'); return; }
    if (!currentMove) return;

    setSaving(true);
    const durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    if (pendingSession.current?.owner !== userId) pendingSession.current = { owner: userId, id: Crypto.randomUUID() };
    const sessionId = pendingSession.current.id;
    const sessionResult = await supabase
      .from('workout_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        exercise_name: currentMove.title || 'Dad Strength',
        duration_minutes: durationMinutes,
        calories: 0,
        performed_at: new Date().toISOString(),
      });

    if (currentOwner.current !== userId) return;
    if (sessionResult.error && !(await workoutSessionAlreadySaved(sessionResult.error, sessionId, userId))) {
      if (currentOwner.current !== userId) return;
      setMessageTone('error');
      setMessage('We could not log this session. Please try again.');
      setSaving(false);
      return;
    }
    // The saved session feeds the canonical Body score; re-read it after the save is confirmed.
    void refreshDashboardForUser(userId);

    if (workout?.id) {
      const completionResult = await supabase.from('workout_completions').insert({
        user_id: userId,
        workout_id: workout.id,
        duration_actual_seconds: elapsedSeconds,
      });
      if (currentOwner.current !== userId) return;
      if (completionResult.error) {
        setMessageTone('error');
        setMessage('Your session was logged, but the workout could not be marked complete. Please try again.');
        setSaving(false);
        setCurrentExerciseIndex((current) => (current + 1) % moves.length);
        return;
      }
    }

    pendingSession.current = null;
    const nextIndex = (currentExerciseIndex + 1) % moves.length;
    const nextMove = moves[nextIndex];
    setMessageTone('success');
    setMessage(nextMove
      ? `Session logged. This workout contributes to your Body score. Next: ${nextMove.title}.`
      : 'Session logged. This workout contributes to your Body score.');
    setCurrentExerciseIndex(nextIndex);
    setSaving(false);
  }, [currentExerciseIndex, currentMove, elapsedSeconds, isOffline, moves, onRequireAuth, showOfflineAction, userId, workout?.id]);

  return (
    <View className="gap-lg">
      <View>
        <Text className="font-heading text-white text-[52px] leading-[52px]">
          {formatTime(elapsedSeconds)}
        </Text>
        <Text className="font-heading-semibold text-tertiary-text text-[11px] tracking-[1px] uppercase mt-xs">
          Workout timer · {formatMoveCount(moves.length)}
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
        <InlineFormError message={!isOffline && messageTone === 'error' ? message : null} className="mt-md" />
        {message && messageTone === 'success' ? (
          <View
            accessibilityRole="alert"
            className="rounded-button border border-lime/40 bg-lime/10 p-md mt-md"
          >
            <Text className="font-heading-bold text-lime text-[13px] tracking-[0.5px] uppercase">
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
                  <Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">{move.detail}</Text>
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

/** A unique-key conflict on our own id means an earlier attempt was saved; confirm it before trusting it. */
async function workoutSessionAlreadySaved(error: { code?: string }, id: string, userId: string) {
  if (error.code !== '23505') return false;
  const existing = await supabase.from('workout_sessions').select('id').eq('id', id).eq('user_id', userId).maybeSingle();
  return !existing.error && Boolean(existing.data);
}
