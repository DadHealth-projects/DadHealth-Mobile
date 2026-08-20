import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import { isProfilePro } from '../lib/proStatus';

export type Reminder = {
  id: string;
  type: string | null;
  text: string;
  time: string | null;
};

export type DadDateItem = {
  id: string;
  icon: string | null;
  name: string;
  age_range: string | null;
  budget: string | null;
  time: string | null;
  duration_minutes: number | null;
};

export type MilestoneItem = {
  id: string;
  date: string;
  text: string;
  photo_url: string | null;
};

export type CircleItem = {
  id: string;
  icon: string | null;
  name: string;
  members_count: number | null;
  /** From `user_circles` — drives the mockup's Joined ✓ / Join state. */
  joined: boolean;
};

export type CommunityPostItem = {
  id: string;
  tag: string | null;
  authorName: string;
  authorInitials: string;
  anonymous: boolean;
  body: string;
};

export type BadgeItem = { icon: string; name: string };

export type MealPlanSummary = {
  /** Web: `Cook Together: {mealTitle}` */
  title: string;
  /** Web: `prep_time` or "Recipe available" */
  time: string;
  loggedDate: string | null;
};

export type DashboardData = {
  displayName: string | null;
  goals: string[];
  /** Raw view values — `null` means "no score yet", which the web treats
   *  differently from 0 (see lib/dashboard.utils.ts). */
  mindScore: number | null;
  bodyScore: number | null;
  bondScore: number | null;
  totalScore: number | null;
  moodLogs: Array<{ date: string; mood_value: number }>;
  checkedInToday: boolean;
  reminders: Reminder[];
  challenge: { title: string; participants_count: number | null } | null;
  dadsCount: number;
  /** `user_streaks.streak_count` — the web sidebar's "N-day streak". */
  streak: number | null;
  /** Derived from `user_profile.subscription_status` (active | trialing). */
  isPro: boolean;

  // ── Fitness (web dashboardPreview/FitnessScreen.tsx) ──
  monthWorkouts: number;
  weightDisplay: string | null;
  activeTodayMin: number;
  /** 7 values 0–4, one per day (web bucket thresholds: 40/25/10/0 minutes). */
  bodyWeekSeries: number[];
  featuredWorkoutTitle: string | null;
  featuredWorkoutMeta: string | null;

  // ── Bond (web dashboardPreview/BondScreen.tsx) ──
  dadDates: DadDateItem[];
  milestones: MilestoneItem[];
  mealPlan: MealPlanSummary | null;

  // ── Community (web dashboardPreview/CommunityScreen.tsx) ──
  circles: CircleItem[];
  posts: CommunityPostItem[];

  // ── Progress (web dashboardPreview/ProgressScreen.tsx) ──
  reportStats: { workouts: number; journal: number; dadDates: number };
  badges: BadgeItem[];
};

type DashboardError = { code?: string; message?: string; details?: string; hint?: string };

const todayKey = () => new Date().toISOString().slice(0, 10);

function errorDetails(error: unknown): DashboardError {
  return typeof error === 'object' && error !== null ? error as DashboardError : {};
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

/** Views can return `null` (no rows yet) — keep that distinct from a real 0. */
function nullableScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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

async function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms),
    ),
  ]);
}

/** Web bucketing for the "body this week" chart (useDashboard.ts). */
function bodyMinutesToBucket(minutes: number): number {
  if (minutes >= 40) return 4;
  if (minutes >= 25) return 3;
  if (minutes >= 10) return 2;
  if (minutes > 0) return 1;
  return 0;
}

async function fetchDashboard(userId: string): Promise<DashboardData> {
  const today = todayKey();
  const weekStartDate = new Date();
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // One round trip, same table set as the web hook. Only the profile read is
  // fatal — every other table degrades to an empty section.
  const [
    profileResult,
    scoresResult,
    moodsResult,
    challengeResult,
    countResult,
    dashboardResult,
    streakResult,
    remindersResult,
    monthWorkoutsResult,
    journalCountResult,
    milestoneCountResult,
    milestonesResult,
    dadDatesResult,
    weightResult,
    todayWorkoutsResult,
    bodyWeekResult,
    latestWorkoutResult,
    mealPlansResult,
    circlesResult,
    userCirclesResult,
    badgesResult,
    postsResult,
  ] = await Promise.all([
    supabase.from('user_profile').select('display_name,goals,is_pro,subscription_status').eq('user_id', userId).maybeSingle(),
    supabase.from('dad_score_view').select('mind_score,body_score,bond_score').eq('user_id', userId).maybeSingle(),
    supabase.from('mood_logs').select('date,mood_value').eq('user_id', userId).gte('date', weekStart).order('date'),
    supabase.from('weekly_challenges').select('title,participants_count').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('user_profile').select('id', { count: 'exact', head: true }),
    supabase.from('dashboard_view').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_streaks').select('streak_count').eq('user_id', userId).maybeSingle(),
    // Same source as the web dashboard (src/hooks/useDashboard.ts).
    supabase.from('reminders').select('id,type,text,time').eq('user_id', userId).order('time', { ascending: true }),
    supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('performed_at', monthStart).lte('performed_at', monthEnd),
    supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthStart).lte('created_at', `${monthEndDate}T23:59:59`),
    supabase.from('milestones').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('date', monthStart).lte('date', monthEndDate),
    supabase.from('milestones').select('id,date,text,photo_url').eq('user_id', userId).order('date', { ascending: false }).limit(8),
    supabase.from('dad_dates').select('id,icon,name,age_range,budget,time_of_day,duration_minutes'),
    supabase.from('body_metrics').select('value').eq('user_id', userId).eq('metric_type', 'weight').order('recorded_at', { ascending: false }).limit(2),
    supabase.from('workout_sessions').select('duration_minutes').eq('user_id', userId).gte('performed_at', todayStart.toISOString()).lte('performed_at', todayEnd.toISOString()),
    supabase.from('workout_sessions').select('performed_at,duration_minutes').eq('user_id', userId).gte('performed_at', sevenDaysAgo.toISOString()),
    supabase.from('workout_sessions').select('exercise_name,duration_minutes,calories,performed_at').eq('user_id', userId).order('performed_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('meal_plans').select('id,plan,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('circles').select('id,icon,name,members_count').order('members_count', { ascending: false }).limit(6),
    supabase.from('user_circles').select('circle_id').eq('user_id', userId),
    supabase.from('earned_badges').select('badges(icon,name)').eq('user_id', userId),
    supabase.from('posts').select('id,content,tag,anonymous,author_initials,author_name').order('created_at', { ascending: false }).limit(20),
  ]);

  if (profileResult.error) throw profileResult.error;
  // Scores and shared collections are nonessential. A restrictive policy should
  // never blank a member's private dashboard.

  const profile = profileResult.data;
  const dashboard = dashboardResult.error
    ? null
    : dashboardResult.data as Record<string, unknown> | null;
  const moodLogs = moodsResult.data ?? [];

  // Prefer the `reminders` table (web's source). If the table is missing or the
  // policy blocks it, fall back to the reminder payload on `dashboard_view` —
  // no extra round trip, no console noise for an expected shape difference.
  const reminders = remindersResult.error
    ? remindersFrom(dashboard?.reminders)
    : remindersFrom(remindersResult.data);

  // Fitness ──────────────────────────────────────────────────────────────────
  const weightRows = (weightResult.data ?? []) as Array<{ value: number }>;
  const latestWeight = weightRows[0]?.value;
  const previousWeight = weightRows[1]?.value;
  const weightDisplay = previousWeight != null && latestWeight != null
    ? `${previousWeight}→${latestWeight}kg`
    : latestWeight != null
      ? `${latestWeight}kg`
      : null;

  const activeTodayMin = ((todayWorkoutsResult.data ?? []) as Array<{ duration_minutes: number | null }>)
    .reduce((sum, row) => sum + (row.duration_minutes ?? 0), 0);

  const bodyTotals = new Map<string, number>();
  for (const row of (bodyWeekResult.error ? [] : (bodyWeekResult.data ?? [])) as Array<{ performed_at: string; duration_minutes: number | null }>) {
    const dayKey = row.performed_at?.slice(0, 10);
    if (!dayKey) continue;
    bodyTotals.set(dayKey, (bodyTotals.get(dayKey) ?? 0) + (row.duration_minutes ?? 0));
  }
  const bodyWeekSeries = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return bodyMinutesToBucket(bodyTotals.get(date.toISOString().slice(0, 10)) ?? 0);
  });

  const latestWorkout = latestWorkoutResult.error ? null : latestWorkoutResult.data;
  const featuredWorkoutTitle = textOrNull(latestWorkout?.exercise_name);
  const featuredWorkoutMetaParts = [
    typeof latestWorkout?.duration_minutes === 'number' ? `${latestWorkout.duration_minutes} min` : null,
    typeof latestWorkout?.calories === 'number' ? `${latestWorkout.calories} kcal` : null,
    typeof latestWorkout?.performed_at === 'string' ? `Logged ${latestWorkout.performed_at.slice(0, 10)}` : null,
  ].filter((part): part is string => Boolean(part));
  const featuredWorkoutMeta = featuredWorkoutMetaParts.length > 0
    ? featuredWorkoutMetaParts.join(' · ')
    : null;

  // Bond ─────────────────────────────────────────────────────────────────────
  const dadDates = ((dadDatesResult.error ? [] : (dadDatesResult.data ?? [])) as Array<Record<string, unknown>>)
    .flatMap((row) => {
      const name = textOrNull(row.name);
      if (!name) return [];
      const duration = typeof row.duration_minutes === 'number' ? row.duration_minutes : null;
      return [{
        id: String(row.id ?? name),
        icon: textOrNull(row.icon),
        name,
        age_range: textOrNull(row.age_range),
        budget: textOrNull(row.budget),
        duration_minutes: duration,
        time: textOrNull(row.time_of_day) ?? (
          duration !== null
            ? (duration >= 60 ? `${Math.floor(duration / 60)} hr` : `${duration} min`)
            : null
        ),
      }];
    });

  const milestones = ((milestonesResult.error ? [] : (milestonesResult.data ?? [])) as Array<Record<string, unknown>>)
    .flatMap((row) => {
      const text = textOrNull(row.text);
      const date = textOrNull(row.date);
      if (!text || !date) return [];
      return [{
        id: String(row.id ?? `${date}-${text}`),
        date,
        text,
        photo_url: textOrNull(row.photo_url),
      }];
    });

  // Same shape the web BondScreen derives from `meal_plans[0].plan.meals`.
  const mealPlanRow = (mealPlansResult.error ? [] : (mealPlansResult.data ?? []))[0] as
    | { plan?: { meals?: Record<string, { name?: string; prep_time?: string }> }; created_at?: string }
    | undefined;
  const firstMeal = mealPlanRow?.plan?.meals
    ? Object.values(mealPlanRow.plan.meals)[0]
    : undefined;
  const mealPlan: MealPlanSummary | null = mealPlanRow?.plan
    ? {
        title: textOrNull(firstMeal?.name) ?? 'Recipe',
        time: textOrNull(firstMeal?.prep_time) ?? 'Recipe available',
        loggedDate: mealPlanRow.created_at ? mealPlanRow.created_at.slice(0, 10) : null,
      }
    : null;

  // Community ────────────────────────────────────────────────────────────────
  const joinedCircleIds = new Set(
    ((userCirclesResult.error ? [] : (userCirclesResult.data ?? [])) as Array<{ circle_id: unknown }>)
      .map((row) => String(row.circle_id)),
  );
  const circles = ((circlesResult.error ? [] : (circlesResult.data ?? [])) as Array<Record<string, unknown>>)
    .flatMap((row) => {
      const name = textOrNull(row.name);
      if (!name) return [];
      const id = String(row.id ?? name);
      return [{
        id,
        icon: textOrNull(row.icon),
        name,
        members_count: typeof row.members_count === 'number' ? row.members_count : null,
        joined: joinedCircleIds.has(id),
      }];
    });

  const posts = ((postsResult.error ? [] : (postsResult.data ?? [])) as Array<Record<string, unknown>>)
    .flatMap((row) => {
      const body = textOrNull(row.content);
      if (!body) return [];
      const anonymous = row.anonymous === true;
      // Web (`enrichCommunityPostRow`) shows "Anonymous" for anonymous posts and
      // the stored display name otherwise, falling back to "Member".
      const authorName = anonymous ? 'Anonymous' : textOrNull(row.author_name) ?? 'Member';
      const storedInitials = textOrNull(row.author_initials);
      return [{
        id: String(row.id ?? body.slice(0, 12)),
        tag: textOrNull(row.tag),
        anonymous,
        authorName,
        authorInitials: anonymous
          ? '?'
          : (storedInitials ?? authorName.charAt(0)).slice(0, 2).toUpperCase(),
        body,
      }];
    });

  // Progress ─────────────────────────────────────────────────────────────────
  const badges = ((badgesResult.error ? [] : (badgesResult.data ?? [])) as Array<{ badges?: BadgeItem | BadgeItem[] | null }>)
    .map((row) => (Array.isArray(row.badges) ? row.badges[0] : row.badges))
    .filter((badge): badge is BadgeItem => Boolean(badge?.icon && badge?.name));

  const monthWorkouts = monthWorkoutsResult.count ?? 0;

  return {
    displayName: profile?.display_name ?? (typeof dashboard?.display_name === 'string' ? dashboard.display_name : null),
    goals: Array.isArray(profile?.goals) ? profile.goals.filter((goal): goal is string => typeof goal === 'string') : [],
    mindScore: nullableScore(scoresResult.data?.mind_score),
    bodyScore: nullableScore(scoresResult.data?.body_score),
    bondScore: nullableScore(scoresResult.data?.bond_score),
    totalScore: nullableScore(dashboard?.total_score),
    moodLogs,
    checkedInToday: moodLogs.some((log) => log.date === today),
    reminders,
    challenge: challengeResult.data ?? null,
    dadsCount: countResult.count ?? 0,
    streak: typeof streakResult.data?.streak_count === 'number' ? streakResult.data.streak_count : null,
    isPro: isProfilePro(profile),

    monthWorkouts,
    weightDisplay,
    activeTodayMin,
    bodyWeekSeries,
    featuredWorkoutTitle,
    featuredWorkoutMeta,

    dadDates,
    milestones,
    mealPlan,

    circles,
    posts,

    reportStats: {
      workouts: monthWorkouts,
      journal: journalCountResult.count ?? 0,
      dadDates: milestoneCountResult.count ?? 0,
    },
    badges,
  };
}

// ── Shared store ───────────────────────────────────────────────────────────
// The dashboard and all four pillar tabs mount together (the tab navigator is
// not lazy), so a per-component hook would run this 22-read fetch five times on
// launch. One cache per user id, one in-flight request, broadcast to every
// subscriber instead.
type StoreState = {
  userId: string | null;
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
};

let store: StoreState = { userId: null, data: null, loading: false, error: null };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function setStore(next: Partial<StoreState>): void {
  store = { ...store, ...next };
  listeners.forEach((listener) => listener());
}

async function runFetch(userId: string): Promise<void> {
  try {
    setStore({ data: await withTimeout(fetchDashboard(userId)), error: null });
  } catch (fetchError) {
    setStore({ error: messageFor(fetchError) });
  } finally {
    setStore({ loading: false });
  }
}

function loadDashboard(userId: string, force: boolean): Promise<void> {
  if (inFlight && !force) return inFlight;
  setStore({ userId, loading: true, error: null });
  const request = runFetch(userId).finally(() => {
    if (inFlight === request) inFlight = null;
  });
  inFlight = request;
  return request;
}

export function useDashboard(userId: string | undefined) {
  const [snapshot, setSnapshot] = useState<StoreState>(store);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    const listener = () => setSnapshot(store);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      // Signed out: drop the cached member data so nothing leaks between users.
      if (store.userId !== null || store.data) {
        setStore({ userId: null, data: null, loading: false, error: null });
      }
      return;
    }
    if (store.userId !== userId) {
      void loadDashboard(userId, true);
      return;
    }
    if (!store.data && !store.loading && !store.error) void loadDashboard(userId, false);
  }, [userId]);

  // Never hand a screen another account's cached rows.
  const data = snapshot.userId === userId ? snapshot.data : null;
  const loading = snapshot.userId === userId ? snapshot.loading : Boolean(userId);
  const error = snapshot.userId === userId ? snapshot.error : null;

  const refresh = useCallback(async () => {
    if (!userId) return;
    await loadDashboard(userId, true);
  }, [userId]);

  const saveCheckIn = useCallback(async (moodValue: number, sleepHours: number): Promise<{ error: string | null }> => {
    if (!userId) return { error: "You're not signed in. Please sign in again to save your check-in." };
    if (!Number.isInteger(moodValue) || moodValue < 1 || moodValue > 4) return { error: 'Choose a mood from 1 to 4.' };
    if (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 12) return { error: 'Enter sleep between 0 and 12 hours.' };

    setCheckingIn(true);
    try {
      const today = todayKey();
      // Same rule as web: never overwrite a wearable-synced sleep row with a
      // manual entry (src/hooks/useDashboard.ts checkIn mutation).
      const { data: existingSleep } = await supabase
        .from('sleep_logs')
        .select('source')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();
      const wearableSleep = existingSleep?.source === 'garmin'
        || existingSleep?.source === 'fitbit'
        || existingSleep?.source === 'apple_health'
        || existingSleep?.source === 'health_connect';

      const [moodResult, sleepResult] = await Promise.all([
        supabase.from('mood_logs').upsert({ user_id: userId, date: today, mood_value: moodValue }, { onConflict: 'user_id,date' }),
        wearableSleep
          ? Promise.resolve({ error: null })
          : supabase.from('sleep_logs').upsert({ user_id: userId, date: today, hours: sleepHours, source: 'manual' }, { onConflict: 'user_id,date' }),
      ]);
      if (moodResult.error) throw moodResult.error;
      if (sleepResult.error) throw sleepResult.error;
      await updateStreak(userId);
      await refresh();
      return { error: null };
    } catch (saveError) {
      return { error: messageFor(saveError).replace('load your dashboard', 'save your check-in') };
    } finally {
      setCheckingIn(false);
    }
  }, [refresh, userId]);

  /** Join / leave a circle (web `useCommunity` toggles `user_circles`). */
  const toggleCircle = useCallback(async (circleId: string, joined: boolean): Promise<void> => {
    if (!userId) return;
    // Optimistic — the row list is small and a failed write is re-synced by refresh().
    if (store.data) {
      setStore({
        data: {
          ...store.data,
          circles: store.data.circles.map((circle) =>
            circle.id === circleId ? { ...circle, joined: !joined } : circle,
          ),
        },
      });
    }
    const result = joined
      ? await supabase.from('user_circles').delete().eq('user_id', userId).eq('circle_id', circleId)
      : await supabase.from('user_circles').insert({ user_id: userId, circle_id: circleId });
    if (result.error) {
      await refresh();
    }
  }, [refresh, userId]);

  return { data, loading, error, checkingIn, refresh, saveCheckIn, toggleCircle };
}
