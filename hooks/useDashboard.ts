import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';

import { useNetworkStatus } from '../contexts/NetworkContext';
import {
  enqueueOfflineWrite,
  readDashboardCache,
  subscribeOfflineSync,
  writeDashboardCache,
  type OfflineDailyCheckInItem,
} from '../lib/offlineStorage';
import { isRetryableOfflineError, PartialDailyCheckInSaveError, persistDailyCheckIn } from '../lib/offlineSync';
import { supabase } from '../lib/supabase';
import { loadNativeSubscriptionStatus } from '../lib/nativeSubscriptions';
import { getCurrentWeekDayKeys, toLocalDateKey } from '../lib/dashboard.utils';
import { buildBodyWeekSeries } from '../lib/bodyActivityWeek';
import { refreshAfterInFlight } from '../lib/refreshAfterInFlight';

const SCORE_QUERY_ERROR = "Dad Health Score couldn't load. Pull to refresh.";

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
  mindWeekChange: number | null;
  bodyWeekChange: number | null;
  bondWeekChange: number | null;
  baselineAvailable: boolean;
  scoreError: string | null;
  totalScore: number | null;
  weakestPillar: 'mind' | 'body' | 'bond' | null;
  recommendedAction: 'checkin' | 'mind_breathing' | 'body_workout' | 'bond_present_mode' | null;
  moodLogs: Array<{
    date: string;
    mood_value: number;
    stress_level: number | null;
    energy_level?: number | null;
    connection_level?: number | null;
  }>;
  checkedInToday: boolean;
  reminders: Reminder[];
  challenge: {
    id: string;
    title: string;
    description: string | null;
    participants_count: number;
  } | null;
  dadsCount: number;
  /** `user_streaks.streak_count` — the web sidebar's "N-day streak". */
  streak: number | null;
  /** From the authenticated status API; null when no fresh server value is available. */
  freezeUsedThisWeek?: boolean | null;
  freezesRemaining?: number | null;
  /** Canonical Pro access from the authenticated subscription-status API. */
  /** Null means authenticated subscription status is not currently confirmed. */
  isPro: boolean | null;
  /** Null means the server subscription status is not currently confirmed. */
  trialActive: boolean | null;

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

const todayKey = () => toLocalDateKey(new Date());

function logCheckInTiming(stage: string, startedAt: number) {
  if (__DEV__) console.info(`[check-in-timing] ${stage}: ${Date.now() - startedAt}ms`);
}

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

async function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms),
    ),
  ]);
}

async function fetchDashboard(userId: string): Promise<DashboardData> {
  const today = todayKey();
  const currentWeekDayKeys = getCurrentWeekDayKeys();
  const weekStart = currentWeekDayKeys[0];
  const [weekYear, weekMonth, weekDay] = weekStart.split('-').map(Number);
  const bodyWeekStart = new Date(weekYear, weekMonth - 1, weekDay);
  const bodyWeekEnd = new Date(bodyWeekStart);
  bodyWeekEnd.setDate(bodyWeekEnd.getDate() + 7);

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
    savedDadDatesCountResult,
    weightResult,
    todayWorkoutsResult,
    bodyWeekResult,
    bodyManualWeekResult,
    latestWorkoutResult,
    mealPlansResult,
    circlesResult,
    userCirclesResult,
    badgesResult,
    postsResult,
    subscriptionStatus,
  ] = await Promise.all([
    supabase.from('user_profile').select('display_name,goals,is_pro,subscription_status').eq('user_id', userId).maybeSingle(),
    supabase.from('dad_score_view').select('mind_score,body_score,bond_score,mind_week_change,body_week_change,bond_week_change,total_score,weakest_pillar,recommended_action,baseline_available').eq('user_id', userId).maybeSingle(),
    supabase.from('mood_logs').select('date,mood_value,mood_scale_version,stress_level,energy_level,connection_level').eq('user_id', userId).gte('date', weekStart).order('date'),
    supabase
      .from('weekly_challenges')
      .select('id,title,description,participants_count')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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
    supabase.from('dad_dates').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('source', 'ai_search'),
    supabase.from('body_metrics').select('value').eq('user_id', userId).eq('metric_type', 'weight').order('recorded_at', { ascending: false }).limit(2),
    supabase.from('workout_sessions').select('duration_minutes').eq('user_id', userId).gte('performed_at', todayStart.toISOString()).lte('performed_at', todayEnd.toISOString()),
    supabase.from('workout_sessions').select('exercise_name,performed_at,duration_minutes').eq('user_id', userId).gte('performed_at', bodyWeekStart.toISOString()).lt('performed_at', bodyWeekEnd.toISOString()),
    supabase.from('activity_logs').select('activity_date,activity_type,other_activity_text,duration_minutes').eq('user_id', userId).eq('pillar', 'body').gte('activity_date', weekStart).lt('activity_date', toLocalDateKey(bodyWeekEnd)),
    supabase.from('workout_sessions').select('exercise_name,duration_minutes,calories,performed_at').eq('user_id', userId).order('performed_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('meal_plans').select('id,plan,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('circles').select('id,icon,name,members_count').order('members_count', { ascending: false }).limit(6),
    supabase.from('user_circles').select('circle_id').eq('user_id', userId),
    supabase.from('earned_badges').select('badges(icon,name)').eq('user_id', userId),
    supabase.from('posts').select('id,content,tag,anonymous,author_initials,author_name').order('created_at', { ascending: false }).limit(20),
    loadNativeSubscriptionStatus().catch(() => null),
  ]);

  if (profileResult.error) throw profileResult.error;
  // Scores and shared collections are nonessential. A restrictive policy should
  // never blank a member's private dashboard.

  const profile = profileResult.data;
  const dashboard = dashboardResult.error
    ? null
    : dashboardResult.data as Record<string, unknown> | null;
  const moodLogs = (moodsResult.data ?? []).map((log) => ({
    date: log.date,
    mood_value: log.mood_scale_version === 1 ? log.mood_value : log.mood_value + 1,
    stress_level: log.stress_level ?? null,
    energy_level: log.energy_level ?? null,
    connection_level: log.connection_level ?? null,
  }));

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

  const bodyWeekSeries = buildBodyWeekSeries(
    currentWeekDayKeys,
    bodyWeekResult.error ? [] : bodyWeekResult.data ?? [],
    bodyManualWeekResult.error ? [] : bodyManualWeekResult.data ?? [],
  );

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
    scoreError: scoresResult.error ? SCORE_QUERY_ERROR : null,
    mindWeekChange: nullableScore(scoresResult.data?.mind_week_change),
    bodyWeekChange: nullableScore(scoresResult.data?.body_week_change),
    bondWeekChange: nullableScore(scoresResult.data?.bond_week_change),
    baselineAvailable: scoresResult.data?.baseline_available === true,
    totalScore: nullableScore(scoresResult.data?.total_score),
    weakestPillar: scoresResult.data?.weakest_pillar === 'mind' || scoresResult.data?.weakest_pillar === 'body' || scoresResult.data?.weakest_pillar === 'bond'
      ? scoresResult.data.weakest_pillar
      : null,
    recommendedAction: scoresResult.data?.recommended_action === 'checkin'
      || scoresResult.data?.recommended_action === 'mind_breathing'
      || scoresResult.data?.recommended_action === 'body_workout'
      || scoresResult.data?.recommended_action === 'bond_present_mode'
      ? scoresResult.data.recommended_action
      : null,
    moodLogs,
    checkedInToday: moodLogs.some((log) => log.date === today),
    reminders,
    challenge: challengeResult.error ? null : challengeResult.data ?? null,
    dadsCount: countResult.count ?? 0,
    streak: typeof streakResult.data?.streak_count === 'number' ? streakResult.data.streak_count : null,
    freezeUsedThisWeek: typeof subscriptionStatus?.freezeUsedThisWeek === 'boolean'
      ? subscriptionStatus.freezeUsedThisWeek
      : null,
    freezesRemaining: typeof subscriptionStatus?.freezesRemaining === 'number'
      ? subscriptionStatus.freezesRemaining
      : null,
    isPro: subscriptionStatus ? subscriptionStatus.isPro === true : null,
    trialActive: subscriptionStatus ? subscriptionStatus.status === 'trialing' : null,

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
      dadDates: savedDadDatesCountResult.count ?? 0,
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
  syncError: string | null;
};

let store: StoreState = { userId: null, data: null, loading: false, error: null, syncError: null };
const listeners = new Set<() => void>();
const inFlightByUser = new Map<string, Promise<void>>();
let activeDashboardUserId: string | null = null;
let dashboardIdentityVersion = 0;

function setStore(next: Partial<StoreState>): void {
  store = { ...store, ...next };
  listeners.forEach((listener) => listener());
}

async function runFetch(userId: string, identityVersion: number): Promise<void> {
  try {
    const data = await withTimeout(fetchDashboard(userId));
    if (store.userId !== userId || dashboardIdentityVersion !== identityVersion) return;
    setStore({ data, error: null });
    try {
      if (dashboardIdentityVersion === identityVersion) await writeDashboardCache(userId, data);
    } catch {
      // A cache write must never turn a successful online dashboard load into
      // a client-facing failure.
    }
  } catch (fetchError) {
    if (store.userId !== userId || dashboardIdentityVersion !== identityVersion) return;
    const current = store.userId === userId ? store.data : null;
    try {
      const cached = await readDashboardCache<DashboardData>(userId);
      if (store.userId !== userId || dashboardIdentityVersion !== identityVersion) return;
      const fallback = cached && typeof cached === 'object' ? cached : current;
      if (fallback && typeof fallback === 'object') {
        const moodLogs = Array.isArray(fallback.moodLogs) ? fallback.moodLogs : [];
        setStore({
          data: {
            ...fallback,
            moodLogs,
            isPro: null,
            trialActive: null,
            checkedInToday: moodLogs.some((log) => log.date === todayKey()),
            freezeUsedThisWeek: null,
            freezesRemaining: null,
          },
          error: cached ? null : messageFor(fetchError),
        });
      } else {
        setStore({ error: messageFor(fetchError) });
      }
    } catch {
      if (store.userId !== userId || dashboardIdentityVersion !== identityVersion) return;
      setStore({
        ...(current ? {
          data: {
            ...current,
            isPro: null,
            trialActive: null,
            freezeUsedThisWeek: null,
            freezesRemaining: null,
          },
        } : {}),
        error: messageFor(fetchError),
      });
    }
  } finally {
    if (store.userId === userId && dashboardIdentityVersion === identityVersion) setStore({ loading: false });
  }
}

async function hydrateDashboardCache(userId: string, clearWhenMissing: boolean, identityVersion?: number): Promise<boolean> {
  try {
    const cached = await readDashboardCache<DashboardData>(userId);
    if (store.userId !== userId || (identityVersion != null && dashboardIdentityVersion !== identityVersion)) return false;
    if (cached && typeof cached === 'object') {
      const moodLogs = Array.isArray(cached.moodLogs) ? cached.moodLogs : [];
      setStore({
        data: {
          ...cached,
          moodLogs,
          isPro: null,
          trialActive: null,
          checkedInToday: moodLogs.some((log) => log.date === todayKey()),
          freezeUsedThisWeek: null,
          freezesRemaining: null,
        },
        error: null,
      });
      return true;
    }
    if (clearWhenMissing) setStore({ data: null, error: null });
  } catch {
    if (clearWhenMissing && store.userId === userId && (identityVersion == null || dashboardIdentityVersion === identityVersion)) {
      setStore({ data: null, error: null });
    }
  }
  return false;
}

async function loadDashboardCacheOnly(userId: string): Promise<void> {
  setStore({
    userId,
    data: store.userId === userId ? store.data : null,
    loading: true,
    error: null,
    syncError: store.userId === userId ? store.syncError : null,
  });
  const identityVersion = dashboardIdentityVersion;
  await hydrateDashboardCache(userId, true, identityVersion);
  if (store.userId === userId && dashboardIdentityVersion === identityVersion) setStore({ loading: false });
}

function loadDashboard(userId: string): Promise<void> {
  if (activeDashboardUserId !== userId) return Promise.resolve();
  const existingRequest = inFlightByUser.get(userId);
  if (existingRequest) return existingRequest;
  const hasCurrentData = store.userId === userId && Boolean(store.data);
  const identityVersion = dashboardIdentityVersion;
  setStore({
    userId,
    data: store.userId === userId ? store.data : null,
    loading: true,
    error: null,
    syncError: store.userId === userId ? store.syncError : null,
  });
  const request = (async () => {
    if (!hasCurrentData) await hydrateDashboardCache(userId, false, identityVersion);
    if (dashboardIdentityVersion !== identityVersion) return;
    await runFetch(userId, identityVersion);
  })().finally(() => {
    if (inFlightByUser.get(userId) === request) inFlightByUser.delete(userId);
  });
  inFlightByUser.set(userId, request);
  return request;
}

function markDashboardEntitlementUnknown(userId: string): void {
  if (store.userId !== userId || !store.data) return;
  if (
    store.data.isPro === null
    && store.data.trialActive === null
    && store.data.freezeUsedThisWeek === null
    && store.data.freezesRemaining === null
  ) return;
  setStore({
    data: {
      ...store.data,
      isPro: null,
      trialActive: null,
      freezeUsedThisWeek: null,
      freezesRemaining: null,
    },
  });
}

export function refreshDashboardForUser(userId: string): Promise<void> {
  return refreshAfterInFlight(inFlightByUser, userId, loadDashboard);
}

export function useDashboard(userId: string | undefined) {
  const { isOffline } = useNetworkStatus();
  const [snapshot, setSnapshot] = useState<StoreState>(store);
  const [checkingIn, setCheckingIn] = useState(false);
  const checkInLock = useRef(false);
  const hasFocused = useRef(false);

  useFocusEffect(useCallback(() => {
    if (!hasFocused.current) {
      hasFocused.current = true;
      return;
    }
    if (userId && !isOffline) void refreshDashboardForUser(userId);
  }, [isOffline, userId]));

  useEffect(() => {
    const listener = () => setSnapshot(store);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const nextUserId = userId ?? null;
    if (activeDashboardUserId !== nextUserId) {
      activeDashboardUserId = nextUserId;
      dashboardIdentityVersion += 1;
      inFlightByUser.clear();
    }
    if (!userId) {
      // Signed out: drop the cached member data so nothing leaks between users.
      if (store.userId !== null || store.data) {
        setStore({ userId: null, data: null, loading: false, error: null, syncError: null });
      }
      return;
    }
    if (isOffline) {
      markDashboardEntitlementUnknown(userId);
      if (store.userId !== userId || (!store.data && !store.loading)) {
        void loadDashboardCacheOnly(userId);
      }
      return;
    }
    if (store.userId !== userId) {
      void loadDashboard(userId);
      return;
    }
    // Unknown entitlement after a successful dashboard load is retried on
    // explicit focus/resume, not on every render.
    if (!store.data && !store.loading) void loadDashboard(userId);
  }, [isOffline, userId]);

  useEffect(() => {
    if (!userId) return;
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && previousState !== 'active') {
        if (!isOffline) void refreshDashboardForUser(userId);
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [isOffline, userId]);

  useEffect(() => subscribeOfflineSync((event) => {
    if (event.userId !== userId || event.kind !== 'daily_checkin') return;
    if (event.status === 'failed') setStore({ syncError: event.message ?? 'Your saved check-in could not be synced.' });
    if (event.status === 'synced') {
      setStore({ syncError: null });
      if (userId && event.kind === 'daily_checkin') void refreshDashboardForUser(userId);
      else if (userId) void loadDashboard(userId);
    }
  }), [userId]);

  // Never hand a screen another account's cached rows.
  const snapshotData = snapshot.userId === userId ? snapshot.data : null;
  const data = isOffline && snapshotData
    ? { ...snapshotData, freezeUsedThisWeek: null, freezesRemaining: null }
    : snapshotData;
  const loading = snapshot.userId === userId ? snapshot.loading : Boolean(userId);
  const error = snapshot.userId === userId ? snapshot.error : null;
  const syncError = snapshot.userId === userId ? snapshot.syncError : null;

  const refresh = useCallback(async () => {
    if (!userId) return;
    if (isOffline) await loadDashboardCacheOnly(userId);
    else await loadDashboard(userId);
  }, [isOffline, userId]);

  const saveCheckIn = useCallback(async (
    moodValue: number,
    energyLevel: number,
    connectionLevel: number,
    sleepHours: number | null,
  ): Promise<{ error: string | null; queued?: boolean; warning?: string; inFlight?: boolean }> => {
    if (!userId) return { error: "You're not signed in. Please sign in again to save your check-in." };
    if (!Number.isInteger(moodValue) || moodValue < 1 || moodValue > 5) return { error: 'Choose a mood from 1 to 5.' };
    if (!Number.isInteger(energyLevel) || energyLevel < 1 || energyLevel > 5) return { error: 'Choose your energy level.' };
    if (!Number.isInteger(connectionLevel) || connectionLevel < 1 || connectionLevel > 5) return { error: 'Choose your connection level.' };
    if (sleepHours != null && (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 12)) return { error: 'Enter sleep between 0 and 12 hours.' };
    if (checkInLock.current) return { error: null, inFlight: true };

    checkInLock.current = true;
    setCheckingIn(true);
    const submissionStartedAt = Date.now();
    const date = todayKey();
    const item: OfflineDailyCheckInItem = {
      id: Crypto.randomUUID(),
      userId,
      kind: 'daily_checkin',
      createdAt: new Date().toISOString(),
      payload: { date, moodValue, energyLevel, connectionLevel, sleepHours },
    };

    const applyLocalCheckIn = async () => {
      if (!store.data || store.userId !== userId) return;
      const previousTodayMood = store.data.moodLogs.find((log) => log.date === date);
      const nextMoodLogs = [
        ...store.data.moodLogs.filter((log) => log.date !== date),
        {
          date,
          mood_value: moodValue,
          stress_level: previousTodayMood?.stress_level ?? null,
          energy_level: energyLevel,
          connection_level: connectionLevel,
        },
      ].sort((a, b) => a.date.localeCompare(b.date));
      const nextData = {
        ...store.data,
        moodLogs: nextMoodLogs,
        checkedInToday: date === todayKey(),
        // Weakest pillar and next action remain server-owned. Hide the stale
        // cached action until the queued check-in syncs and the view refreshes.
        recommendedAction: null,
        freezeUsedThisWeek: null,
        freezesRemaining: null,
      };
      setStore({ data: nextData, error: null, syncError: null });
      try {
        await writeDashboardCache(userId, nextData);
      } catch (cacheError) {
        if (__DEV__) console.warn('[check-in-timing] local dashboard cache write failed', cacheError);
      }
    };

    try {
      if (isOffline) {
        const queueStartedAt = Date.now();
        await enqueueOfflineWrite(item);
        logCheckInTiming('durable offline queue', queueStartedAt);
        await applyLocalCheckIn();
        logCheckInTiming('offline save total', submissionStartedAt);
        return { error: null, queued: true };
      }

      const saveStartedAt = Date.now();
      await persistDailyCheckIn(item);
      logCheckInTiming('online data save', saveStartedAt);
      await applyLocalCheckIn();
      logCheckInTiming('online save total', submissionStartedAt);
      const refreshStartedAt = Date.now();
      void refreshDashboardForUser(userId)
        .then(() => logCheckInTiming('background dashboard refresh', refreshStartedAt))
        .catch((error) => {
          if (__DEV__) console.warn('[check-in-timing] background refresh failed', error);
        });
      return { error: null };
    } catch (saveError) {
      if (saveError instanceof PartialDailyCheckInSaveError) {
        await applyLocalCheckIn();
        if (isRetryableOfflineError(saveError.saveError)) {
          try {
            const queueStartedAt = Date.now();
            await enqueueOfflineWrite(item);
            logCheckInTiming('partial save queued for retry', queueStartedAt);
            logCheckInTiming('partial save total', submissionStartedAt);
            return { error: null, queued: true };
          } catch {
            void refreshDashboardForUser(userId).catch(() => undefined);
            return {
              error: null,
              warning: "Check-in saved, but Sleep could not be queued. You can save Sleep again when reconnected.",
            };
          }
        }
        const refreshStartedAt = Date.now();
        void refreshDashboardForUser(userId)
          .then(() => logCheckInTiming('partial background refresh', refreshStartedAt))
          .catch(() => undefined);
        logCheckInTiming('partial save total', submissionStartedAt);
        return {
          error: null,
          warning: 'Check-in saved, but Sleep could not be saved. You can save Sleep again.',
        };
      }
      if (isRetryableOfflineError(saveError)) {
        try {
          const queueStartedAt = Date.now();
          await enqueueOfflineWrite(item);
          logCheckInTiming('retry queued offline', queueStartedAt);
          await applyLocalCheckIn();
          logCheckInTiming('retry queue total', submissionStartedAt);
          return { error: null, queued: true };
        } catch {
          return { error: "We couldn't save your check-in on this device. Reconnect and try again." };
        }
      }
      return { error: messageFor(saveError).replace('load your dashboard', 'save your check-in') };
    } finally {
      checkInLock.current = false;
      setCheckingIn(false);
    }
  }, [isOffline, userId]);

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

  return { data, loading, error, syncError, checkingIn, refresh, saveCheckIn, toggleCircle };
}
