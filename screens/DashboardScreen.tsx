import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { User } from '@supabase/supabase-js';
import { useIsFocused, useNavigation, useRoute, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../components/AppTopBar';
import type { DashboardSection } from '../components/AccountSheet';
import ChallengeCard from '../components/dashboard/ChallengeCard';
import CheckInFollowUp from '../components/dashboard/CheckInFollowUp';
import DailyCheckInModal from '../components/dashboard/DailyCheckInModal';
import GlobalErrorToastReporter from '../components/GlobalErrorToastReporter';
import DadScoreCard from '../components/dashboard/DadScoreCard';
import FadeInView from '../components/FadeInView';
import GreetingHeader from '../components/dashboard/GreetingHeader';
import HomeSkeleton from '../components/skeleton/HomeSkeleton';
import ScoreDetailSheet from '../components/dashboard/ScoreDetailSheet';
import RemindersList from '../components/dashboard/RemindersList';
import ScreenTransition from '../components/ScreenTransition';
import StreakCard from '../components/dashboard/StreakCard';
import SupportingTools, { type SupportingTool } from '../components/dashboard/SupportingTools';
import TodayFocusCard from '../components/dashboard/TodayFocusCard';
import WeeklyReportCard from '../components/dashboard/WeeklyReportCard';
import { useAuth } from '../contexts/AuthContext';
import { refreshDashboardForUser, useDashboard } from '../hooks/useDashboard';
import { useFitnessLibrary } from '../hooks/useFitnessLibrary';
import { useCookTogetherRecipes } from '../hooks/useCookTogetherRecipes';
import { useEntitlement } from '../hooks/useEntitlement';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { useUpgradeMomentManager } from '../contexts/UpgradeMomentContext';
import { CAPS } from '../lib/dashboardCaps';
import {
  getDashboardScore,
  getScoreBreakdown,
  toLocalDateKey,
} from '../lib/dashboard.utils';
import dailyCheckInPrompt, { type DailyCheckInPromptState } from '../lib/dailyCheckInPrompt.js';
import type { CheckInAction } from '../lib/checkInRecommendation';
import { showCrisisSupportDetails } from '../lib/crisisSupport';
import { navigateToProSubscription } from '../lib/proNavigation';
import { greetingFirstName } from '../lib/userDisplay';
import { isWeeklyReportDay } from '../lib/weeklyReport';
import { useWeeklyReport } from '../hooks/useWeeklyReport';
import { colors } from '../theme';
import BondScreen from './BondScreen';
import CommunityScreen from './CommunityScreen';
import FitnessScreen from './FitnessScreen';
import MindScreen from './MindScreen';
import type { AppStackParamList } from '../navigation/AppNavigator';

// TODAY top-centre brand logo (dark-background colour logo).
const TODAY_LOGO = require('../assets/02. DAD HEALTH LOGO_COLOR_Dark BG.png');
const attemptedCheckInPromptSessions = new Set<string>();

/** Signed-in dashboard screen, kept separate from the public Home experience. */
export default function DashboardScreen({
  openScoreDetail = false,
  onScoreDetailRequestConsumed,
}: {
  openScoreDetail?: boolean;
  onScoreDetailRequestConsumed?: () => void;
}) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<DashboardSection>('HOME');
  const [foregroundSessionId, setForegroundSessionId] = useState(0);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && previousState !== 'active') {
        setForegroundSessionId((sessionId) => sessionId + 1);
      }
      previousState = state;
    });
    return () => subscription.remove();
  }, []);

  if (!user?.id) return null;

  const sectionProps = {
    dashboardSection: activeSection,
    onSelectDashboardSection: setActiveSection,
  };

  let screen: React.ReactNode;
  if (activeSection === 'FITNESS') screen = <FitnessScreen {...sectionProps} />;
  else if (activeSection === 'MIND') screen = <MindScreen {...sectionProps} />;
  else if (activeSection === 'BOND') screen = <BondScreen {...sectionProps} />;
  else if (activeSection === 'COMMUNITY') screen = <CommunityScreen {...sectionProps} />;
  else screen = (
    <DashboardScreenContent
      key={user.id}
      user={user}
      foregroundSessionId={foregroundSessionId}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      openScoreDetail={openScoreDetail || activeSection === 'PROGRESS'}
      onScoreDetailRequestConsumed={onScoreDetailRequestConsumed}
    />
  );

  return <ScreenTransition key={activeSection}>{screen}</ScreenTransition>;
}

/**
 * Member dashboard — every feature of the web dashboard Home
 * (`dashboardPreview/HomeScreen.tsx` + the streak from its Sidebar), laid out as
 * Mockup 1: hero opener → lime score-ring card with the 5-emotion check-in
 * inside it → the remaining features as native cards.
 */
export function DashboardScreenContent({
  user,
  foregroundSessionId,
  activeSection = 'HOME',
  onSelectSection,
  openScoreDetail = false,
  onScoreDetailRequestConsumed,
}: {
  user: User;
  foregroundSessionId: number;
  activeSection?: DashboardSection;
  onSelectSection?: (section: DashboardSection) => void;
  openScoreDetail?: boolean;
  onScoreDetailRequestConsumed?: () => void;
}) {
  const { pendingBiometricEnrollment } = useAuth();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const route = useRoute();
  const { requestMoment } = useUpgradeMomentManager();
  const { data, loading, error: dashboardError, syncError, checkingIn, refresh, saveCheckIn } = useDashboard(user.id);
  const weeklyWorkoutState = useFitnessLibrary(user.id, activeSection === 'HOME', activeSection === 'HOME' && isFocused);
  const cookTogetherState = useCookTogetherRecipes(user.id);
  const {
    weeklyWorkout,
    assignmentKnown,
    loading: workoutLoading,
    error: workoutError,
    refresh: refreshWeeklyWorkout,
  } = weeklyWorkoutState;
  const {
    weeklyRecipe,
    assignmentKnown: recipeAssignmentKnown,
    loading: recipeLoading,
    weeklyRecipeError,
    refresh: refreshCookTogether,
  } = cookTogetherState;
  const entitlement = useEntitlement({
    isPro: data?.isPro ?? null,
    trialActive: data?.trialActive ?? null,
    loading,
  });
  const buildMyPlanAccess = entitlement.can('mind_plan');
  const scoreInsightsAccess = entitlement.can('score_insights');
  const weeklyReportAccess = entitlement.can('weekly_report');
  const streakFreezeAccess = entitlement.can('streak_freeze');
  const { dismissToast, isOffline } = useNetworkStatus();
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [scoreSheetOpen, setScoreSheetOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [promptDecisionReadyKey, setPromptDecisionReadyKey] = useState<string | null>(null);
  const promptStateRef = useRef<DailyCheckInPromptState | null>(null);
  const promptSessionRequestKey = useRef<string | null>(null);
  const refreshInFlight = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const todayDate = toLocalDateKey(new Date());
  const promptDecisionKey = `${user.id}:${todayDate}:${foregroundSessionId}`;
  const dailyCheckInStorageKey = `dadhealth.daily-check-in-prompt.v2.${user.id}`;
  const waitForPromptDecision = Boolean(
    isFocused && activeSection === 'HOME' && data?.checkedInToday === false &&
    !checkInModalOpen && !scoreSheetOpen && !openScoreDetail && !pendingBiometricEnrollment &&
    !attemptedCheckInPromptSessions.has(promptDecisionKey) &&
    promptDecisionReadyKey !== promptDecisionKey,
  );
  const showHomeSkeleton = (!data && !dashboardError) || waitForPromptDecision;

  const displayName = useMemo(
    () => greetingFirstName(data?.displayName, user),
    [data?.displayName, user],
  );

  const score = useMemo(
    () =>
      getDashboardScore(
        {
          total_score: data?.totalScore ?? null,
          mind_score: data?.mindScore ?? null,
          body_score: data?.bodyScore ?? null,
          bond_score: data?.bondScore ?? null,
        },
        true,
      ),
    [data?.totalScore, data?.mindScore, data?.bodyScore, data?.bondScore],
  );

  const scoreItems = useMemo(() => {
    const breakdown = getScoreBreakdown(
      {
        mind_score: data?.mindScore ?? null,
        body_score: data?.bodyScore ?? null,
        bond_score: data?.bondScore ?? null,
      },
      Boolean(data),
    );
    const weakest = data?.weakestPillar;
    const allPillarsCritical = [breakdown.mind, breakdown.body, breakdown.bond]
      .every((value) => value === 5 || value === 10);
    const trends = [data?.mindWeekChange, data?.bodyWeekChange, data?.bondWeekChange];
    return [
      { label: 'Mind', value: breakdown.mind, trend: trends[0] ?? null, showNeutralTrend: true, highlighted: weakest === 'mind', warning: allPillarsCritical && weakest === 'mind' },
      { label: 'Body', value: breakdown.body, trend: trends[1] ?? null, showNeutralTrend: true, highlighted: weakest === 'body', warning: allPillarsCritical && weakest === 'body' },
      {
        label: 'Bond',
        value: breakdown.bond,
        trend: trends[2] ?? null,
        showNeutralTrend: true,
        highlighted: weakest === 'bond',
        warning: allPillarsCritical && weakest === 'bond',
      },
    ];
  }, [data]);

  const scoreDetailItems = scoreItems;

  const reminders = useMemo(
    () => (data?.reminders ?? []).slice(0, CAPS.reminders),
    [data?.reminders],
  );

  const handleCheckIn = useCallback(async ({ moodValue, energyLevel, connectionLevel, sleepHours }: {
    moodValue: number;
    energyLevel: number;
    connectionLevel: number;
    sleepHours: number | null;
  }) => saveCheckIn(moodValue, energyLevel, connectionLevel, sleepHours), [saveCheckIn]);

  const todayFocus = useMemo(() => {
    if (data?.checkedInToday === null && data?.recommendedAction === 'checkin') return null;
    if (data?.recommendedAction === 'checkin') return 'checkin';
    if (data?.recommendedAction === 'mind_breathing') return 'mind';
    if (data?.recommendedAction === 'body_workout') return 'body';
    if (data?.recommendedAction === 'bond_present_mode') return 'bond';
    return null;
  }, [data?.bodyScore, data?.bondScore, data?.checkedInToday, data?.mindScore, data?.recommendedAction]);

  // The report is part of Today on Sunday after its configured 08:00 release.
  const showWeeklyReport = isWeeklyReportDay();
  const { report: weeklyReport, loading: weeklyReportLoading, error: weeklyReportError } = useWeeklyReport(user?.id, weeklyReportAccess === true, showWeeklyReport);

  // Read today's persisted pillar answers and legacy Stress for follow-up.
  const checkedInMood = useMemo(() => {
    const today = toLocalDateKey(new Date());
    return data?.moodLogs.find((log) => log.date === today)?.mood_value ?? 4;
  }, [data?.moodLogs]);
  const checkedInEnergy = useMemo(() => {
    const today = toLocalDateKey(new Date());
    return data?.moodLogs.find((log) => log.date === today)?.energy_level ?? null;
  }, [data?.moodLogs]);
  const checkedInConnection = useMemo(() => {
    const today = toLocalDateKey(new Date());
    return data?.moodLogs.find((log) => log.date === today)?.connection_level ?? null;
  }, [data?.moodLogs]);
  const checkedInStress = useMemo(() => {
    const today = toLocalDateKey(new Date());
    return data?.moodLogs.find((log) => log.date === today)?.stress_level ?? null;
  }, [data?.moodLogs]);

  const openCheckInAction = useCallback((action: CheckInAction) => {
    if (action === 'breathing') navigation.navigate('BreathingSession');
    else if (action === 'journal') navigation.navigate('Journal');
    else if (action === 'body') navigation.navigate('Tabs', { screen: 'Fit' });
    else if (action === 'support') showCrisisSupportDetails();
    else navigation.navigate('Tabs', { screen: 'Bond' });
  }, [navigation]);

  const openPro = useCallback((source: string, context: string, interaction: 'lock' | 'cta' | 'badge' = 'cta', feature = source) => {
    navigateToProSubscription(navigation, source, context, user.id, interaction, feature);
  }, [navigation, user.id]);

  const scoreDetailRequestHandled = useRef(false);
  const openScoreInsights = useCallback(() => setScoreSheetOpen(true), []);

  const openDailyCheckIn = useCallback(() => {
    attemptedCheckInPromptSessions.add(promptDecisionKey);
    setPromptDecisionReadyKey(promptDecisionKey);
    setReminderMessage(null);
    setCheckInModalOpen(true);
  }, [promptDecisionKey]);

  const initialCheckInAnswers = useMemo(() => {
    const today = toLocalDateKey(new Date());
    const log = data?.moodLogs.find((entry) => entry.date === today);
    return {
      moodValue: log?.mood_value ?? null,
      energyLevel: log?.energy_level ?? null,
      connectionLevel: log?.connection_level ?? null,
    };
  }, [data?.moodLogs]);

  useEffect(() => {
    if (!isFocused || activeSection !== 'HOME' || !data || data.checkedInToday === null || loading) return undefined;

    if (data.checkedInToday) {
      setPromptDecisionReadyKey(promptDecisionKey);
      return undefined;
    }

    if (checkInModalOpen) {
      attemptedCheckInPromptSessions.add(promptDecisionKey);
      setPromptDecisionReadyKey(promptDecisionKey);
      return undefined;
    }

    if (scoreSheetOpen || pendingBiometricEnrollment || openScoreDetail) {
      setPromptDecisionReadyKey(promptDecisionKey);
      return undefined;
    }

    if (attemptedCheckInPromptSessions.has(promptDecisionKey)) {
      setPromptDecisionReadyKey(promptDecisionKey);
      return undefined;
    }

    if (promptSessionRequestKey.current === promptDecisionKey) return undefined;

    promptSessionRequestKey.current = promptDecisionKey;
    let active = true;

    const applyDecision = (storedState: DailyCheckInPromptState) => {
      const decision = dailyCheckInPrompt.getNextDailyCheckInPrompt(
        storedState,
        user.id,
        todayDate,
        false,
      );
      promptStateRef.current = decision.state;
      attemptedCheckInPromptSessions.add(promptDecisionKey);
      promptSessionRequestKey.current = null;
      setPromptDecisionReadyKey(promptDecisionKey);
      if (!decision.shouldShow || decision.reminderNumber === null) return;

      setReminderMessage(dailyCheckInPrompt.dailyCheckInReminderCopy(decision.reminderNumber));
      setCheckInModalOpen(true);
      void AsyncStorage.setItem(dailyCheckInStorageKey, JSON.stringify(decision.state)).catch(() => undefined);
    };

    const currentState = promptStateRef.current;
    if (currentState?.userId === user.id && currentState.date === todayDate) {
      applyDecision(currentState);
    } else {
      void AsyncStorage.getItem(dailyCheckInStorageKey)
        .then((rawState) => {
          if (!active) return;
          const storedState = dailyCheckInPrompt.parseDailyCheckInPromptState(rawState, user.id, todayDate);
          promptStateRef.current = storedState;
          applyDecision(storedState);
        })
        .catch(() => {
          if (!active) return;
          const emptyState = dailyCheckInPrompt.parseDailyCheckInPromptState(null, user.id, todayDate);
          promptStateRef.current = emptyState;
          applyDecision(emptyState);
        });
    }

    return () => {
      active = false;
      if (promptSessionRequestKey.current === promptDecisionKey) promptSessionRequestKey.current = null;
    };
  }, [activeSection, checkInModalOpen, dailyCheckInStorageKey, data, isFocused, loading, openScoreDetail, pendingBiometricEnrollment, promptDecisionKey, scoreSheetOpen, todayDate, user.id]);

  useEffect(() => {
    if (openScoreDetail && !scoreDetailRequestHandled.current) {
      scoreDetailRequestHandled.current = true;
      setScoreSheetOpen(true);
      onScoreDetailRequestConsumed?.();
    } else if (!openScoreDetail) {
      scoreDetailRequestHandled.current = false;
    }
  }, [onScoreDetailRequestConsumed, openScoreDetail]);

  const closeScoreSheet = useCallback(() => {
    setScoreSheetOpen(false);
    if (activeSection === 'PROGRESS') onSelectSection?.('HOME');
  }, [activeSection, onSelectSection]);

  const openCheckInPlan = useCallback(() => {
    if (buildMyPlanAccess === false) {
      requestMoment({
        id: 'checkIn', screen: route.key, feature: 'mind_plan',
        isPro: entitlement.isPro, trialActive: entitlement.trialActive,
        loading: entitlement.loading, featureAccess: buildMyPlanAccess,
        hasCompletedAction: Boolean(data?.checkedInToday), userId: user.id,
      });
    }
    else if (buildMyPlanAccess === true) {
  navigation.navigate('Tabs', {
    screen: 'Mind',
    params: { openPersonalisedPlan: true },
  });
}
  }, [buildMyPlanAccess, data?.checkedInToday, entitlement.isPro, entitlement.loading, entitlement.trialActive, navigation, requestMoment, route.key, user.id]);

  const openFocus = useCallback(() => {
    if (todayFocus === 'checkin') {
      openDailyCheckIn();
    } else if (todayFocus === 'mind') {
      navigation.navigate('BreathingSession');
    } else if (todayFocus === 'body') {
      if (weeklyWorkout?.id) navigation.navigate('ActiveWorkout', { workoutId: weeklyWorkout.id });
      else navigation.navigate('Tabs', { screen: 'Fit' });
    } else if (todayFocus === 'bond') {
      navigation.navigate('Tabs', { screen: 'Bond' });
    }
  }, [navigation, openDailyCheckIn, todayFocus, weeklyWorkout?.id]);

  const focusContent = useMemo(() => {
    if (todayFocus === 'checkin') return {
      title: 'Check in with yourself',
      description: "Answer today's Mind, Body and Bond questions.",
      actionLabel: 'Check in now',
      icon: 'check-circle' as const,
    };
    if (todayFocus === 'mind') return {
      title: 'Take a five-minute reset',
      description: 'Start with one minute of 4-4-4 breathing, then continue into the guided reset.',
      actionLabel: 'Start five-minute reset',
      icon: 'wind' as const,
    };
    if (todayFocus === 'body') return {
      title: weeklyWorkout?.title ?? 'Move your body',
      description: weeklyWorkout
        ? `${weeklyWorkout.exercises.length} ${weeklyWorkout.exercises.length === 1 ? 'move' : 'moves'} · ${weeklyWorkout.duration_mins} min`
        : workoutError
          ? "Couldn't load this week's workout. Pull to refresh."
          : workoutLoading
            ? "Checking this week's workout…"
            : assignmentKnown
              ? 'No workout has been assigned this week yet. Check Body for updates.'
              : 'Connect to the internet to check this week’s workout.',
      actionLabel: weeklyWorkout ? 'Start workout' : 'View Body',
      icon: 'activity' as const,
    };
    if (todayFocus === 'bond') return {
      title: 'Make time to connect',
      description: 'Choose one intentional moment with your family today.',
      actionLabel: 'Open Present Dad Mode',
      icon: 'heart' as const,
    };
    return null;
  }, [assignmentKnown, todayFocus, weeklyWorkout, workoutError, workoutLoading]);

  const officialDadDateSuggestion = data?.dadDates?.find(
    (activity) => activity.source === 'admin' && activity.user_id === null,
  );
  const officialDadDateTime = officialDadDateSuggestion?.time_of_day?.trim();
  const officialDadDateTimeLabel = officialDadDateTime && !/^any\s+time$/i.test(officialDadDateTime)
    ? officialDadDateTime
    : null;

  const supportingTools = useMemo<SupportingTool[]>(() => [
    {
      key: 'workout',
      icon: 'activity',
      title: weeklyWorkout?.title ?? 'Weekly workout',
      detail: weeklyWorkout
        ? `${weeklyWorkout.duration_mins} min · ${weeklyWorkout.exercises.length} ${weeklyWorkout.exercises.length === 1 ? 'move' : 'moves'}`
        : workoutError
          ? "Couldn't load this week's workout. Pull to refresh."
          : workoutLoading
            ? "Checking this week's workout…"
            : assignmentKnown
              ? 'No workout assigned this week. Check Body for updates.'
              : 'Connect to the internet to check this week’s workout.',
      onPress: () => weeklyWorkout?.id
        ? navigation.navigate('ActiveWorkout', { workoutId: weeklyWorkout.id })
        : navigation.navigate('Tabs', { screen: 'Fit' }),
    },
    {
      key: 'meal',
      icon: 'coffee',
      title: weeklyRecipe?.title ?? 'Cook Together',
      detail: weeklyRecipe
        ? `${weeklyRecipe.prep_mins} min · Cook with your kids this week.`
        : weeklyRecipeError
          ? "Couldn't load this week's recipe. Pull to refresh."
          : recipeLoading
            ? "Checking this week's featured recipe…"
            : recipeAssignmentKnown
              ? 'No recipe is scheduled for this week.'
              : isOffline
                ? "Connect to the internet to check this week's recipe."
                : "Couldn't confirm this week's recipe. Pull to refresh.",
      onPress: () => navigation.navigate('CookTogether'),
    },
    {
      key: 'bond',
      icon: 'heart',
      title: officialDadDateSuggestion?.name ?? 'Bond suggestion',
      detail: officialDadDateTimeLabel ?? 'Find one simple way to connect today.',
      onPress: () => navigation.navigate('Tabs', { screen: 'Bond' }),
    },
  ], [assignmentKnown, isOffline, navigation, officialDadDateSuggestion?.name, officialDadDateTimeLabel, recipeAssignmentKnown, recipeLoading, weeklyRecipe, weeklyRecipeError, weeklyWorkout, workoutError, workoutLoading]);

  const handleRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    // A refresh makes the previous failure notice stale.
    dismissToast();
    setRefreshing(true);
    try {
      await Promise.all([
        isOffline ? refresh() : refreshDashboardForUser(user.id),
        refreshWeeklyWorkout(),
        refreshCookTogether(),
      ]);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [dismissToast, isOffline, refresh, refreshCookTogether, refreshWeeklyWorkout, user.id]);

  if (showHomeSkeleton) {
    return (
      <SafeAreaView key="home-skeleton" edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
        <View className="px-lg pt-lg">
          <AppTopBar
            showNavigation
            showBrand
            brandAlign="center"
            brandSource={TODAY_LOGO}
            activeSection={activeSection}
            onSelectSection={onSelectSection}
          />
        </View>
        <HomeSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      key="home-content"
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.dark }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-lg pt-lg pb-[120px] gap-lg"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.lime} />
          }
        >
          <AppTopBar
            showNavigation
            showBrand
            brandAlign="center"
            brandSource={TODAY_LOGO}
            activeSection={activeSection}
            onSelectSection={onSelectSection}
          />
          <GlobalErrorToastReporter message={dashboardError && !data && !isOffline ? "We couldn't bring in today's check-in, score and plan. Try again in a moment." : data?.scoreError} />
          <GlobalErrorToastReporter message={syncError} />

          {!data ? (
            <DadScoreCard
              score={null}
              compactBottom
              items={[{ label: 'Mind', value: null }, { label: 'Body', value: null }, { label: 'Bond', value: null }]}
              missingScore="—"
              missingItemValue="—"
            />
          ) : null}

          {data ? (
            <>
              <FadeInView>
                <GreetingHeader
                  name={displayName}
                />
              </FadeInView>

              <FadeInView delay={90}>
                <View className="relative">
                  <DadScoreCard
                    score={score}
                    scoreUnavailable={Boolean(data.scoreError)}
                    baselineBuilding={!data.scoreError && !data.baselineAvailable}
                    items={scoreItems}
                    title="Dad Health Score"
                    scoreLabel="of 100"
                    proTease="Your insights"
                    proTeaseLocked={scoreInsightsAccess === false}
                    userId={user.id}
                    compactBottom
                  />
                  <Pressable
                    onPress={openScoreInsights}
                    accessibilityRole="button"
                    accessibilityLabel="Open Dad Health Score details"
                    className="absolute inset-0"
                  />
                </View>
              </FadeInView>

              {data.checkedInToday ? (
                <FadeInView delay={190}>
                  <CheckInFollowUp
                    moodValue={checkedInMood}
                    stressLevel={checkedInStress}
                    energyLevel={checkedInEnergy}
                    connectionLevel={checkedInConnection}
                    planAccess={buildMyPlanAccess}
                    userId={user.id}
                    onAction={openCheckInAction}
                    onPlan={openCheckInPlan}
                  />
                </FadeInView>
              ) : null}

              <FadeInView delay={200}>
                <StreakCard
                  streak={data.streak}
                  freezeAccess={streakFreezeAccess}
                  freezeUsedThisWeek={data.freezeUsedThisWeek}
                  freezesRemaining={data.freezesRemaining}
                  userId={user.id}
                  onUpgrade={() => openPro('streak_freeze', 'Freeze your streak once a week', 'lock')}
                />
              </FadeInView>

              <FadeInView delay={220}>
                <ChallengeCard
                  challenge={data.challenge}
                  onOpenChallenge={data.challenge
                    ? () => navigation.navigate('WeeklyChallenge', { challengeId: data.challenge!.id })
                    : undefined}
                />
              </FadeInView>

              <FadeInView delay={240}>
                {focusContent ? <TodayFocusCard {...focusContent} onPress={openFocus} /> : null}
              </FadeInView>

              {showWeeklyReport ? (
                <FadeInView delay={260}>
                  <WeeklyReportCard
                    report={weeklyReport}
                    reportAccess={weeklyReportAccess}
                    currentScore={data.totalScore}
                    loading={weeklyReportLoading}
                    error={weeklyReportError}
                    userId={user.id}
                    onUpgrade={() => requestMoment({
                      id: 'weeklyReport', screen: route.key, feature: 'weekly_report',
                      isPro: entitlement.isPro, trialActive: entitlement.trialActive,
                      loading: entitlement.loading, featureAccess: weeklyReportAccess,
                      hasCompletedAction: Boolean(data.checkedInToday || data.moodLogs.length > 0), userId: user.id,
                    })}
                  />
                </FadeInView>
              ) : null}

              <FadeInView delay={280}>
                <SupportingTools tools={supportingTools} />
              </FadeInView>

              {reminders.length > 0 ? (
                <FadeInView delay={320}>
                  <RemindersList reminders={reminders} />
                </FadeInView>
              ) : null}

              <ScoreDetailSheet
                visible={scoreSheetOpen}
                onClose={closeScoreSheet}
                score={score}
                scoreUnavailable={Boolean(data.scoreError)}
                baselineBuilding={!data.scoreError && !data.baselineAvailable}
                items={scoreDetailItems}
                isPro={scoreInsightsAccess === true}
                entitlementKnown={scoreInsightsAccess !== null}
                userId={user.id}
                  onUpgrade={() => openPro('score', 'Understand your score', 'lock', 'score_insights')}
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <DailyCheckInModal
        key={user.id}
        visible={checkInModalOpen}
        reminderMessage={reminderMessage}
        initialAnswers={initialCheckInAnswers}
        saving={checkingIn}
        onClose={() => setCheckInModalOpen(false)}
        onSave={handleCheckIn}
      />
    </SafeAreaView>
  );
}
