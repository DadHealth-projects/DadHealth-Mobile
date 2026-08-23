import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import GlobalErrorToastReporter from '../components/GlobalErrorToastReporter';
import DadScoreCard from '../components/dashboard/DadScoreCard';
import FadeInView from '../components/FadeInView';
import GreetingHeader from '../components/dashboard/GreetingHeader';
import HomeSkeleton from '../components/skeleton/HomeSkeleton';
import MoodWeekCard from '../components/dashboard/MoodWeekCard';
import RemindersList from '../components/dashboard/RemindersList';
import TodaysPlan from '../components/dashboard/TodaysPlan';
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
import { buildGoalsFromProfile, type DashboardGoalStatus } from '../lib/goalPlan';
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

  if (activeSection === 'FITNESS') return <FitnessScreen {...sectionProps} />;
  if (activeSection === 'MIND') return <MindScreen {...sectionProps} />;
  if (activeSection === 'BOND') return <BondScreen {...sectionProps} />;
  if (activeSection === 'COMMUNITY') return <CommunityScreen {...sectionProps} />;
  if (activeSection === 'PROGRESS') return <ProgressScreen {...sectionProps} />;

  return (
    <DashboardScreenContent
      user={user}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    />
  );
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
  const [sleep, setSleep] = useState('7');
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [goalStatuses, setGoalStatuses] = useState<Record<string, DashboardGoalStatus>>({});
  const [showRefreshSkeleton, setShowRefreshSkeleton] = useState(false);

  const now = useMemo(() => new Date(), []);
  const dateLabel = useMemo(
    () => now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    [now],
  );
  const weekday = useMemo(() => now.toLocaleDateString('en-GB', { weekday: 'long' }), [now]);
  const displayName = useMemo(
    () => greetingFirstName(data?.displayName, user).toUpperCase(),
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
    return [
      { label: 'Mind', value: breakdown.mind },
      { label: 'Body', value: breakdown.body },
      { label: 'Bond', value: breakdown.bond },
    ];
  }, [data]);

  const moodWeek = useMemo(
    () => getMoodWeek(data?.moodLogs ?? [], getLastSevenDayKeys()),
    [data?.moodLogs],
  );
  const moodSummary = useMemo(() => getMoodSummary(moodWeek, Boolean(data)), [moodWeek, data]);

  const baseGoals = useMemo(() => buildGoalsFromProfile(data?.goals), [data?.goals]);
  const goals = useMemo(
    () =>
      baseGoals.map((goal) => {
        const status = goalStatuses[goal.name];
        return status ? { ...goal, status } : goal;
      }),
    [baseGoals, goalStatuses],
  );

  const reminders = useMemo(
    () => (data?.reminders ?? []).slice(0, CAPS.reminders),
    [data?.reminders],
  );

  const handleGoalAction = useCallback(
    (index: number) => {
      const goal = baseGoals[index];
      if (!goal) return;
      setGoalStatuses((current) =>
        current[goal.name] === 'done' ? current : { ...current, [goal.name]: 'done' },
      );
    },
    [baseGoals],
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

  const handleCheckIn = useCallback(async () => {
    setCheckInError(null);
    setCheckInMessage(null);
    const sleepHours = Number(sleep);
    if (!sleep.trim() || !Number.isFinite(sleepHours)) {
      setCheckInError('Enter the hours you slept last night.');
      return;
    }
    const result = await saveCheckIn(moodValue, sleepHours);
    if (result.error) setCheckInError(result.error);
    else if (result.queued) setCheckInMessage("Saved — will sync when you're back online");
  }, [moodValue, saveCheckIn, sleep]);

  const handleRefresh = useCallback(async () => {
    setShowRefreshSkeleton(true);
    try {
      await refresh();
    } finally {
      setShowRefreshSkeleton(false);
    }
  }, [refresh]);

  if ((!data && !dashboardError) || showRefreshSkeleton) {
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl"
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void handleRefresh()} tintColor={colors.lime} />
          }
        >
          <AppTopBar
            showNavigation
            showBrand
            activeSection={activeSection}
            onSelectSection={onSelectSection}
          />
          <GlobalErrorToastReporter message={dashboardError && !data && !isOffline ? "We couldn't bring in today's check-in, score and plan. Try again in a moment." : null} />
          <GlobalErrorToastReporter message={syncError} />

          {!data ? (
            <View className="gap-md">
              {checkInMessage ? (
                <Text accessibilityLiveRegion="polite" className="font-body text-lime text-[13px] leading-[19px]">{checkInMessage}</Text>
              ) : (
                <DadScoreCard
                  score={null}
                  items={[{ label: 'Mind', value: null }, { label: 'Body', value: null }, { label: 'Bond', value: null }]}
                  missingScore="—"
                  missingItemValue="—"
                >
                  <CheckInPanel
                    selectedKey={moodKey}
                    onSelectMood={handleSelectMood}
                    sleep={sleep}
                    onChangeSleep={handleChangeSleep}
                    onSave={() => void handleCheckIn()}
                    saving={checkingIn}
                    error={checkInError}
                  />
                </DadScoreCard>
              )}
            </View>
          ) : null}

          {data ? (
            <>
              <FadeInView>
                <GreetingHeader
                  name={displayName}
                  weekday={weekday}
                  dateLabel={dateLabel}
                  dadsCount={data.dadsCount}
                  isPro={data.isPro}
                  streak={data.streak}
                />
              </FadeInView>

              <FadeInView delay={90}>
                <DadScoreCard score={score} items={scoreItems}>
                  {!data.checkedInToday ? (
                    <CheckInPanel
                      selectedKey={moodKey}
                      onSelectMood={handleSelectMood}
                      sleep={sleep}
                      onChangeSleep={handleChangeSleep}
                      onSave={() => void handleCheckIn()}
                      saving={checkingIn}
                      error={checkInError}
                    />
                  ) : null}
                </DadScoreCard>
                {checkInMessage ? <Text accessibilityLiveRegion="polite" className="font-body text-lime text-[13px] leading-[19px] mt-sm">{checkInMessage}</Text> : null}
              </FadeInView>

              {!data.isPro ? (
                <FadeInView delay={150}>
                  <UpgradeProCard onPress={() => navigation.navigate('ProSubscription')} />
                </FadeInView>
              ) : null}

              <FadeInView delay={190}>
                <TodaysPlan goals={goals} onGoalAction={handleGoalAction} />
              </FadeInView>

              <FadeInView delay={240}>
                <MoodWeekCard values={moodWeek} labels={MOOD_WEEK_LABELS} summary={moodSummary} />
              </FadeInView>

              <FadeInView delay={290}>
                <RemindersList reminders={reminders} />
              </FadeInView>

              <FadeInView delay={340}>
                <ChallengeCard
                  challenge={data.challenge}
                  onOpenChallenge={data.challenge
                    ? () => navigation.navigate('WeeklyChallenge', { challengeId: data.challenge!.id })
                    : undefined}
                />
              </FadeInView>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
