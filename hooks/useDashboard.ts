import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

export type Reminder = {
  id: string;
  type: string | null;
  text: string;
  time: string | null;
};

export type DashboardData = {
  displayName: string | null;
  goals: string[];
  mindScore: number;
  bodyScore: number;
  bondScore: number;
  moodLogs: Array<{ date: string; mood_value: number }>;
  checkedInToday: boolean;
  reminders: Reminder[];
  challenge: { title: string; participants_count: number | null } | null;
  dadsCount: number;
};

type DashboardError = { code?: string; message?: string; details?: string; hint?: string };

const todayKey = () => new Date().toISOString().slice(0, 10);

function errorDetails(error: unknown): DashboardError {
  return typeof error === 'object' && error !== null ? error as DashboardError : {};
}

function logFailure(operation: string, error: unknown): void {
  const detail = errorDetails(error);
  console.warn('[dashboard]', JSON.stringify({
    operation,
    code: detail.code,
    message: detail.message,
    details: detail.details,
    hint: detail.hint,
  }));
}

function messageFor(error: unknown): string {
  const detail = errorDetails(error);
  const text = detail.message?.toLowerCase() ?? '';
  if (text.includes('timeout')) {
  return "DadHealth is taking longer than expected. Please try again.";
}
  if (detail.code === '42501' || text.includes('permission') || text.includes('row-level security')) {
    return "We couldn't verify your account. Please sign in again, then reload your dashboard.";
  }
  if (text.includes('network') || text.includes('fetch') || text.includes('timeout')) {
   return "We couldn't reach DadHealth. Check your internet connection and pull down to try again.";
  }
  if (detail.code === '429' || text.includes('rate limit')) {
    return 'Too many requests. Please wait a moment, then try again.';
  }
  return "Couldn't load today's dashboard. Please try again.";
}

function numberScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function remindersFrom(value: unknown): Reminder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const reminder = item as Record<string, unknown>;
    if (typeof reminder.id !== 'string' || typeof reminder.text !== 'string') return [];
    return [{
      id: reminder.id,
      text: reminder.text,
      type: typeof reminder.type === 'string' ? reminder.type : null,
      time: typeof reminder.time === 'string' ? reminder.time : null,
    }];
  });
}

async function updateStreak(userId: string): Promise<void> {
  const today = todayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const { data: existing, error: readError } = await supabase
    .from('user_streaks')
    .select('streak_count,last_activity_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.last_activity_date === today) return;

  const streakCount = existing?.last_activity_date === yesterdayKey
    ? (existing.streak_count ?? 0) + 1
    : 1;
  const { error: writeError } = await supabase
    .from('user_streaks')
    .upsert({ user_id: userId, streak_count: streakCount, last_activity_date: today }, { onConflict: 'user_id' });
  if (writeError) throw writeError;
}

async function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms),
    ),
  ]);
}

async function fetchDashboard(userId: string): Promise<DashboardData> {
  const today = todayKey();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const weekStart = start.toISOString().slice(0, 10);

  const [profileResult, scoresResult, moodsResult, challengeResult, countResult, dashboardResult] = await Promise.all([
    supabase.from('user_profile').select('display_name,goals').eq('user_id', userId).maybeSingle(),
    supabase.from('dad_score_view').select('mind_score,body_score,bond_score').eq('user_id', userId).maybeSingle(),
    supabase.from('mood_logs').select('date,mood_value').eq('user_id', userId).gte('date', weekStart).order('date'),
    supabase.from('weekly_challenges').select('title,participants_count').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('user_profile').select('id', { count: 'exact', head: true }),
    supabase.from('dashboard_view').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  // Scores and shared collections are nonessential. A restrictive policy should
  // never blank a member's private dashboard.
  if (scoresResult.error) logFailure('loadScores', scoresResult.error);
  if (moodsResult.error) logFailure('loadMoodLogs', moodsResult.error);
  if (challengeResult.error) logFailure('loadChallenge', challengeResult.error);
  if (countResult.error) logFailure('loadCommunityCount', countResult.error);

  const profile = profileResult.data;
  const dashboard = dashboardResult.error
    ? null
    : dashboardResult.data as Record<string, unknown> | null;
  const moodLogs = moodsResult.data ?? [];
  return {
    displayName: profile?.display_name ?? (typeof dashboard?.display_name === 'string' ? dashboard.display_name : null),
    goals: Array.isArray(profile?.goals) ? profile.goals.filter((goal): goal is string => typeof goal === 'string') : [],
    mindScore: numberScore(scoresResult.data?.mind_score),
    bodyScore: numberScore(scoresResult.data?.body_score),
    bondScore: numberScore(scoresResult.data?.bond_score),
    moodLogs,
    checkedInToday: moodLogs.some((log) => log.date === today),
    // This project currently has no public.reminders table. When the dashboard
    // view exposes its reminder payload, it will render here without a schema-
    // probing request or console warning.
    reminders: remindersFrom(dashboard?.reminders),
    challenge: challengeResult.data ?? null,
    dadsCount: countResult.count ?? 0,
  };
}

export function useDashboard(userId: string | undefined) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await withTimeout(fetchDashboard(userId)));
    } catch (fetchError) {
      logFailure('loadDashboard', fetchError);
      setError(messageFor(fetchError));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
  let mounted = true;

  (async () => {
    if (!mounted) return;
    await refresh();
  })();

  return () => {
    mounted = false;
  };
}, [refresh]);

  const saveCheckIn = useCallback(async (moodValue: number, sleepHours: number): Promise<{ error: string | null }> => {
    if (!userId) return { error: "You're not signed in. Please sign in again to save your check-in." };
    if (!Number.isInteger(moodValue) || moodValue < 1 || moodValue > 4) return { error: 'Choose a mood from 1 to 4.' };
    if (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 24) return { error: 'Enter sleep between 0 and 24 hours.' };

    setCheckingIn(true);
    try {
      const today = todayKey();
      const [moodResult, sleepResult] = await Promise.all([
        supabase.from('mood_logs').upsert({ user_id: userId, date: today, mood_value: moodValue }, { onConflict: 'user_id,date' }),
        supabase.from('sleep_logs').upsert({ user_id: userId, date: today, hours: sleepHours, source: 'manual' }, { onConflict: 'user_id,date' }),
      ]);
      if (moodResult.error) throw moodResult.error;
      if (sleepResult.error) throw sleepResult.error;
      await updateStreak(userId);
      await refresh();
      return { error: null };
    } catch (saveError) {
      logFailure('saveCheckIn', saveError);
      return { error: messageFor(saveError).replace('load your dashboard', 'save your check-in') };
    } finally {
      setCheckingIn(false);
    }
  }, [refresh, userId]);

  return { data, loading, error, checkingIn, refresh, saveCheckIn };
}
