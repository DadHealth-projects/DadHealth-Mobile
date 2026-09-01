import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { User } from '@supabase/supabase-js';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../components/AppTopBar';
import type { DashboardSection } from '../components/AccountSheet';
import ChallengeCard from '../components/dashboard/ChallengeCard';
import CheckInPanel from '../components/dashboard/CheckInPanel';
import ScreenErrorNotice from '../components/ScreenErrorNotice';
import DadScoreCard from '../components/dashboard/DadScoreCard';
import FadeInView from '../components/FadeInView';
import GreetingHeader from '../components/dashboard/GreetingHeader';
import HomeSkeleton from '../components/skeleton/HomeSkeleton';
import MoodWeekCard from '../components/dashboard/MoodWeekCard';
import RemindersList from '../components/dashboard/RemindersList';
import ScreenTransition from '../components/ScreenTransition';
import StreakCard from '../components/dashboard/StreakCard';
import SupportingTools, { type SupportingTool } from '../components/dashboard/SupportingTools';
import TodayFocusCard from '../components/dashboard/TodayFocusCard';
import UpgradeProCard from '../components/dashboard/UpgradeProCard';
import type { MoodKey } from '../components/mockup/MoodCheckInRow';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { CAPS } from '../lib/dashboardCaps';
import {
  MOOD_WEEK_LABELS,
  getDashboardScore,
  getLastSevenDayKeys,
  getMoodSummary,
  getMoodWeek,
  getScoreBreakdown,
} from '../lib/dashboard.utils';
import { selectTodayFocus, strongestPositiveTrend } from '../lib/todayFocus';
import { greetingFirstName } from '../lib/userDisplay';
import { colors } from '../theme';
import BondScreen from './BondScreen';
import CommunityScreen from './CommunityScreen';
import FitnessScreen from './FitnessScreen';
import MindScreen from './MindScreen';
import ProgressScreen from './subscreens/ProgressScreen';
import type { AppStackParamList } from '../navigation/AppNavigator';

/** Signed-in dashboard screen, kept separate from the public Home experience. */
export default function DashboardScreen() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<DashboardSection>('HOME');

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
  else if (activeSection === 'PROGRESS') screen = <ProgressScreen {...sectionProps} />;
  else screen = (
    <DashboardScreenContent
      user={user}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
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
  activeSection = 'HOME',
  onSelectSection,
}: {
  user: User;
  activeSection?: DashboardSection;
  onSelectSection?: (section: DashboardSection) => void;
}) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data, loading, error: dashboardError, syncError, checkingIn, refresh, saveCheckIn } = useDashboard(user.id);
  const { isOffline } = useNetworkStatus();
  // Web pre-selects mood 3 ("Good") and 7 hours of sleep.
  const [moodKey, setMoodKey] = useState<MoodKey>('good');
  const [moodValue, setMoodValue] = useState(3);
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [sleep, setSleep] = useState('7');
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [showCheckInSuccess, setShowCheckInSuccess] = useState(false);
  const refreshInFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const checkInOffset = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

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
    const weakest = selectTodayFocus(true, {
      mind: breakdown.mind,
      body: breakdown.body,
      bond: breakdown.bond,
    });
    // The basic score and its pillar values are free. The week-on-week trend
    // arrows are a Pro weekly trend, so they are withheld from free members.
    const trendFor = (change: number | null | undefined) => (data?.isPro ? change ?? null : null);
    return [
      { label: 'Mind', value: breakdown.mind, trend: trendFor(data?.mindWeekChange), highlighted: weakest === 'mind' },
      { label: 'Body', value: breakdown.body, trend: trendFor(data?.bodyWeekChange), highlighted: weakest === 'body' },
      {
        label: 'Bond',
        value: breakdown.bond,
        trend: trendFor(data?.bondWeekChange),
        highlighted: weakest === 'bond',
        warning: weakest === 'bond' && breakdown.bond !== null && breakdown.bond < 50,
      },
    ];
  }, [data]);

  const moodWeek = useMemo(
    () => getMoodWeek(data?.moodLogs ?? [], getLastSevenDayKeys()),
    [data?.moodLogs],
  );
  const moodSummary = useMemo(() => getMoodSummary(moodWeek, Boolean(data)), [moodWeek, data]);

  const reminders = useMemo(
    () => (data?.reminders ?? []).slice(0, CAPS.reminders),
    [data?.reminders],
  );

  const handleSelectMood = useCallback((key: MoodKey, value: number) => {
    setMoodKey(key);
    setMoodValue(value);
    setCheckInError(null);
    setCheckInMessage(null);
  }, []);

  const handleChangeSleep = useCallback((value: string) => {
    setSleep(value);
    setCheckInError(null);
    setCheckInMessage(null);
  }, []);

  const handleSelectStress = useCallback((value: number) => {
    setStressLevel(value);
    setCheckInError(null);
    setCheckInMessage(null);
  }, []);

  useEffect(() => {
    if (!showCheckInSuccess) return undefined;
    const timer = setTimeout(() => setShowCheckInSuccess(false), 3500);
    return () => clearTimeout(timer);
  }, [showCheckInSuccess]);

  const handleCheckIn = useCallback(async () => {
    setCheckInError(null);
    setCheckInMessage(null);
    const sleepHours = Number(sleep);
    if (!sleep.trim() || !Number.isFinite(sleepHours)) {
      setCheckInError('Enter the hours you slept last night.');
      return;
    }
    if (stressLevel === null) {
      setCheckInError('Choose how stressed you feel today.');
      return;
    }
    const result = await saveCheckIn(moodValue, stressLevel, sleepHours);
    if (result.error) setCheckInError(result.error);
    else if (result.queued) {
      setCheckInMessage("Saved — will sync when you're back online. Once synced, this check-in contributes to your Mind score.");
      setShowCheckInSuccess(true);
    } else {
      setCheckInMessage(result.mindScore == null
        ? 'Check-in saved. This check-in contributes to your Mind score.'
        : `Check-in saved. Your Mind score is now ${Math.round(result.mindScore)}.`);
      setShowCheckInSuccess(true);
    }
  }, [moodValue, saveCheckIn, sleep, stressLevel]);

  const todayFocus = useMemo(() => selectTodayFocus(Boolean(data?.checkedInToday), {
    mind: data?.mindScore ?? null,
    body: data?.bodyScore ?? null,
    bond: data?.bondScore ?? null,
  }), [data?.bodyScore, data?.bondScore, data?.checkedInToday, data?.mindScore]);

  const proInsight = useMemo(() => {
    const trend = strongestPositiveTrend({
      Mind: data?.mindWeekChange ?? null,
      Body: data?.bodyWeekChange ?? null,
      Bond: data?.bondWeekChange ?? null,
    });
    return trend ? `Your ${trend[0]} score is up ${Math.round(trend[1])} points this week.` : null;
  }, [data?.bodyWeekChange, data?.bondWeekChange, data?.mindWeekChange]);

  const openFocus = useCallback(() => {
    if (todayFocus === 'checkin') {
      scrollRef.current?.scrollTo({ y: Math.max(0, checkInOffset.current - 16), animated: true });
    } else if (todayFocus === 'mind') {
      navigation.navigate('BreathingSession');
    } else if (todayFocus === 'body') {
      navigation.navigate('ActiveWorkout', data?.suggestedWorkout?.id ? { workoutId: data.suggestedWorkout.id } : undefined);
    } else {
      navigation.navigate('Tabs', { screen: 'Bond' });
    }
  }, [data?.suggestedWorkout?.id, navigation, todayFocus]);

  const focusContent = useMemo(() => {
    if (todayFocus === 'checkin') return {
      title: 'Check in with yourself',
      description: "Answer today's three questions and see how they shape your Mind score.",
      actionLabel: 'Check in now',
      icon: 'check-circle' as const,
    };
    if (todayFocus === 'mind') return {
      title: 'Take a two-minute reset',
      description: 'Slow your breathing and give your mind a moment to settle.',
      actionLabel: 'Start breathing',
      icon: 'wind' as const,
    };
    if (todayFocus === 'body') return {
      title: data?.suggestedWorkout?.title ?? 'Move your body',
      description: data?.suggestedWorkout
        ? `${data.suggestedWorkout.moveCount} ${data.suggestedWorkout.moveCount === 1 ? 'move' : 'moves'} · ${data.suggestedWorkout.durationMins} min`
        : 'Start a simple workout and build your Body score.',
      actionLabel: 'Start workout',
      icon: 'activity' as const,
    };
    return {
      title: 'Make time to connect',
      description: 'Choose one intentional moment with your family today.',
      actionLabel: 'Open Present Dad Mode',
      icon: 'heart' as const,
    };
  }, [data?.suggestedWorkout, todayFocus]);

  const supportingTools = useMemo<SupportingTool[]>(() => [
    {
      key: 'workout',
      icon: 'activity',
      title: data?.suggestedWorkout?.title ?? 'Workout suggestion',
      detail: data?.suggestedWorkout
        ? `${data.suggestedWorkout.durationMins} min · ${data.suggestedWorkout.moveCount} ${data.suggestedWorkout.moveCount === 1 ? 'move' : 'moves'}`
        : 'Choose a workout that fits your day.',
      onPress: () => navigation.navigate('ActiveWorkout', data?.suggestedWorkout?.id ? { workoutId: data.suggestedWorkout.id } : undefined),
    },
    {
      key: 'meal',
      icon: 'coffee',
      title: data?.mealPlan?.title ?? 'Meal plan',
      detail: data?.mealPlan?.time ?? 'Plan something straightforward for the family.',
      onPress: () => navigation.navigate('MealPlanner'),
    },
    {
      key: 'bond',
      icon: 'heart',
      title: data?.dadDates?.[0]?.name ?? 'Bond suggestion',
      detail: data?.dadDates?.[0]?.time ?? 'Find one simple way to connect today.',
      onPress: () => navigation.navigate('Tabs', { screen: 'Bond' }),
    },
  ], [data?.dadDates, data?.mealPlan, data?.suggestedWorkout, navigation]);

  const captureCheckInOffset = useCallback((event: LayoutChangeEvent) => {
    checkInOffset.current = event.nativeEvent.layout.y;
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [refresh]);

  if ((!data && !dashboardError) || refreshing) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
        <View className="px-lg pt-lg">
          <AppTopBar
            showNavigation
            showBrand
            activeSection={activeSection}
            onSelectSection={onSelectSection}
          />
        </View>
        <HomeSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.lime} />
          }
        >
          <AppTopBar
            showNavigation
            showBrand
            activeSection={activeSection}
            onSelectSection={onSelectSection}
          />
          <ScreenErrorNotice message={dashboardError && !data && !isOffline ? "We couldn't bring in today's check-in, score and plan. Try again in a moment." : null} />
          <ScreenErrorNotice message={syncError} />

          {!data ? (
            <View className="gap-md">
              {checkInMessage ? (
                <Text accessibilityLiveRegion="polite" className="font-body text-lime text-[13px] leading-[19px]">{checkInMessage}</Text>
              ) : (
                <>
                  <DadScoreCard
                    score={null}
                    items={[{ label: 'Mind', value: null }, { label: 'Body', value: null }, { label: 'Bond', value: null }]}
                    missingScore="—"
                    missingItemValue="—"
                  />
                  <View onLayout={captureCheckInOffset} className="bg-lime rounded-card px-xl py-xl mt-lg">
                    <Text className="font-heading-bold text-dark text-[22px] uppercase mb-xs">Today's check-in</Text>
                    <Text className="font-body text-dark/60 text-[13px] leading-[18px] mb-lg">Three quick questions about how you are doing today.</Text>
                    <CheckInPanel
                      selectedKey={moodKey}
                      onSelectMood={handleSelectMood}
                      stressLevel={stressLevel}
                      onSelectStress={handleSelectStress}
                      sleep={sleep}
                      onChangeSleep={handleChangeSleep}
                      onSave={() => void handleCheckIn()}
                      saving={checkingIn}
                      error={checkInError}
                    />
                  </View>
                </>
              )}
            </View>
          ) : null}

          {data ? (
            <>
              <FadeInView>
                <GreetingHeader
                  name={displayName}
                />
              </FadeInView>

              <FadeInView delay={90}>
                <DadScoreCard score={score} items={scoreItems} title="Dad Health Score" scoreLabel="of 100" />
              </FadeInView>

              {/* Pro moment 1 — after the Dad Health Score. Suppressed while
                  moment 2 is on screen so Today never carries two upgrade asks
                  in one scroll. */}
              {!data.isPro && !showCheckInSuccess ? (
                <FadeInView delay={140}>
                  <UpgradeProCard
                    onPress={() => navigation.navigate('ProSubscription')}
                    insight={proInsight}
                    ctaLabel="Unlock my insights"
                    accessibilityLabel="Unlock Dad Health Pro insights"
                  />
                </FadeInView>
              ) : null}

              {!data.checkedInToday || showCheckInSuccess ? (
              <FadeInView delay={180}>
                <View onLayout={captureCheckInOffset} className="bg-lime rounded-card px-xl py-xl">
                  <Text className="font-heading-bold text-dark text-[22px] uppercase mb-xs">Today's check-in</Text>
                  {!data.checkedInToday && !showCheckInSuccess ? (
                    <>
                      <Text className="font-body text-dark/60 text-[13px] leading-[18px] mb-lg">Three quick questions about how you are doing today.</Text>
                    <CheckInPanel
                      selectedKey={moodKey}
                      onSelectMood={handleSelectMood}
                      stressLevel={stressLevel}
                      onSelectStress={handleSelectStress}
                      sleep={sleep}
                      onChangeSleep={handleChangeSleep}
                      onSave={() => void handleCheckIn()}
                      saving={checkingIn}
                      error={checkInError}
                    />
                    </>
                  ) : (
                    <View className="flex-row items-start gap-md mt-md">
                      <Text className="font-heading-bold text-dark text-[24px]">✓</Text>
                      <View className="flex-1">
                        <Text className="font-heading-bold text-dark text-[16px] uppercase">Check-in complete</Text>
                        <Text accessibilityLiveRegion="polite" className="font-body text-dark/65 text-[13px] leading-[19px] mt-xs">
                          {checkInMessage ?? `Your check-in feeds into your Mind score${data.mindScore == null ? '.' : `, now ${Math.round(data.mindScore)}.`}`}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </FadeInView>
              ) : null}

              {/* Your one focus — the approved free recommendation, sitting
                  directly after the check-in as the Today hierarchy requires.
                  Mapping is unchanged: incomplete check-in first, then
                  Mind → breathing, Body → suggested workout, Bond → Present Dad. */}
              <FadeInView delay={200}>
                <TodayFocusCard {...focusContent} onPress={openFocus} />
              </FadeInView>

              {/* Pro moment 2 — after the check-in, and only ever after the free
                  recommendation above it. */}
              {!data.isPro && showCheckInSuccess ? (
                <FadeInView delay={230}>
                  <UpgradeProCard
                    onPress={() => navigation.navigate('ProSubscription')}
                    insight="Pro can do more. Get a plan built around your mood, your activity and your Dad Health Score."
                  />
                </FadeInView>
              ) : null}

              {/* The seven-day mood trend is Pro, on Today as well as on Mind.
                  Free members see the preview; the upgrade route is the Pro
                  moment above rather than another ask here. */}
              <FadeInView delay={250}>
                <MoodWeekCard values={moodWeek} labels={MOOD_WEEK_LABELS} summary={moodSummary} locked={!data.isPro} />
              </FadeInView>

              <FadeInView delay={260}>
                <StreakCard streak={data.streak} />
              </FadeInView>

              <FadeInView delay={300}>
                <SupportingTools tools={supportingTools} />
              </FadeInView>

              <FadeInView delay={340}>
                <ChallengeCard
                  challenge={data.challenge}
                  onOpenChallenge={data.challenge
                    ? () => navigation.navigate('WeeklyChallenge', { challengeId: data.challenge!.id })
                    : undefined}
                />
              </FadeInView>

              <FadeInView delay={380}>
                <RemindersList reminders={reminders} />
              </FadeInView>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
