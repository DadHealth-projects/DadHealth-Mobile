import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';

import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import GlobalErrorToastReporter from '../components/GlobalErrorToastReporter';
import InlineFormError from '../components/InlineFormError';
import LimeButton from '../components/LimeButton';
import MiniBarChart from '../components/dashboard/MiniBarChart';
import PillarScoreRow from '../components/dashboard/PillarScoreRow';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ProUpgradeSection from '../components/ProUpgradeSection';
import BodyProLockedCard from '../components/body/BodyProLockedCard';
import ProBadge from '../components/dashboard/ProBadge';
import ScreenHero from '../components/mockup/ScreenHero';
import SectionHeader from '../components/dashboard/SectionHeader';
import StatCard from '../components/dashboard/StatCard';
import ManualActivitySection from '../components/manualActivities/ManualActivitySection';
import TagPill from '../components/dashboard/TagPill';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { useEntitlement } from '../hooks/useEntitlement';
import { useFitnessLibrary } from '../hooks/useFitnessLibrary';
import { useFitnessSummary } from '../hooks/useFitnessSummary';
import { MOOD_WEEK_LABELS } from '../lib/dashboard.utils';
import { PRO_LOCKS, PRO_MOMENTS } from '../lib/proMoments';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { BottomTabsParamList } from '../navigation/BottomTabNavigator';
import { syncAppleHealthIfConnected } from '../lib/appleHealth';
import { navigateToProSubscription } from '../lib/proNavigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

const EMPTY_BODY_WEEK = [0, 0, 0, 0, 0, 0, 0];

const EQUIPMENT_LABEL = {
  none: 'No equipment',
  dumbbells: 'Dumbbells',
  full_gym: 'Full gym',
} as const;

const FOCUS_LABEL = {
  full_body: 'Full body',
  upper: 'Upper body',
  lower: 'Lower body',
  core: 'Core',
} as const;

function formatMoveCount(count: number): string {
  return `${count} ${count === 1 ? 'move' : 'moves'}`;
}

function FlatSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <View className={`border-b border-border pb-lg ${className}`}>{children}</View>;
}

/**
 * Fit tab — every feature of the web dashboard FITNESS screen
 * (`dashboardPreview/FitnessScreen.tsx`): the four stat cards, the featured
 * workout card, the TDEE teaser and the body-this-week chart. Copy verbatim,
 * laid out in the mockups' native card language.
 */
export default function FitnessScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const { user } = useAuth();
  const hasUser = Boolean(user?.id);
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const tabNavigation = useNavigation<NavigationProp<BottomTabsParamList, 'Fit'>>();
  const route = useRoute<RouteProp<BottomTabsParamList, 'Fit'>>();
  const openWorkoutLibrary = route.name === 'Fit' && route.params?.openWorkoutLibrary === true;
  const standalone = !dashboardSection;
  const { data, loading, error, refresh } = useDashboard(user?.id);
  const entitlement = useEntitlement({
    isPro: data?.isPro ?? null,
    trialActive: data?.trialActive ?? null,
    loading,
  });
  const aiWorkoutAccess = hasUser ? entitlement.can('ai_workout') : null;
  const mealPlannerAccess = hasUser ? entitlement.can('meal_planner') : null;
  const workoutLibraryAccess = hasUser
  ? entitlement.can('workout_library') === true
    ? true
    : false
  : null;
  const weeklyWorkoutAccess = hasUser && entitlement.can('free_weekly_workout') === true;
  const trendsAccess = entitlement.can('trends');
  const { data: fitnessSummary, refresh: refreshSummary } = useFitnessSummary(
    standalone ? user?.id : undefined,
  );
  const fitnessLibrary = useFitnessLibrary(user?.id, standalone, standalone, false);
  const refreshLibrary = fitnessLibrary.refresh;
  const refreshInFlight = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [workoutLibraryOpen, setWorkoutLibraryOpen] = useState(false);
  useEffect(() => {
    if (!standalone || !openWorkoutLibrary) return;
    setWorkoutLibraryOpen(true);
    tabNavigation.setParams({ openWorkoutLibrary: undefined });
  }, [tabNavigation, openWorkoutLibrary, standalone]);
  const [accessCheckAttempted, setAccessCheckAttempted] = useState(false);
  const checkEntitlement = useCallback(async () => {
    setAccessCheckAttempted(true);
    await refresh();
  }, [refresh]);
  const availableWorkouts = useMemo(
    () => workoutLibraryAccess === true
      ? fitnessLibrary.workouts
      : weeklyWorkoutAccess
        ? fitnessLibrary.workouts.filter((workout) => workout.source === 'admin' && (
          workout.access_level === 'free' || workout.id === fitnessLibrary.weeklyWorkout?.id
        ))
        : [],
    [fitnessLibrary.weeklyWorkout?.id, fitnessLibrary.workouts, weeklyWorkoutAccess, workoutLibraryAccess],
  );
  const libraryProblem = fitnessLibrary.libraryError
    ?? (workoutLibraryAccess === true ? null : fitnessLibrary.assignmentError);
  const libraryEmptyKnown = fitnessLibrary.hasLoaded
    && (workoutLibraryAccess === true || (workoutLibraryAccess === false && fitnessLibrary.assignmentKnown));
  const selectedWorkout = useMemo(
    () => workoutLibraryAccess !== true ? fitnessLibrary.weeklyWorkout
      : availableWorkouts.find((workout) => workout.id === selectedWorkoutId)
      ?? fitnessLibrary.weeklyWorkout
      ?? (workoutLibraryAccess === true ? availableWorkouts.find((workout) => workout.source === 'admin') : null)
      ?? null,
    [availableWorkouts, fitnessLibrary.weeklyWorkout, selectedWorkoutId, workoutLibraryAccess],
  );
  const moveCount = selectedWorkout?.exercises?.length ?? 0;
  const moveCountLabel = formatMoveCount(moveCount);
  const workoutName = selectedWorkout?.title.trim()
    ?? (fitnessLibrary.assignmentKnown ? 'No featured workout this week' : 'Your workout this week');
  const workoutMeta = selectedWorkout
    ? `${moveCountLabel} · ${selectedWorkout.duration_mins} min · ${EQUIPMENT_LABEL[selectedWorkout.equipment]}`
    : moveCountLabel;

  const requireAuth = useCallback(() => navigation.navigate('Login'), [navigation]);
  const openActiveWorkout = useCallback(
    () => navigation.navigate('ActiveWorkout', selectedWorkout?.id ? { workoutId: selectedWorkout.id } : undefined),
    [navigation, selectedWorkout?.id],
  );
  const generatedWorkout = useMemo(
    () => aiWorkoutAccess === true
      ? fitnessLibrary.workouts.find((workout) => workout.source === 'ai_generated') ?? null
      : null,
    [aiWorkoutAccess, fitnessLibrary.workouts],
  );
  const openAIWorkout = useCallback(
    () => navigation.navigate('AIWorkout', generatedWorkout ? { workoutId: generatedWorkout.id } : undefined),
    [generatedWorkout, navigation],
  );
  const openMealPlanner = useCallback(() => navigation.navigate('MealPlanner'), [navigation]);
  const onRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      if (user?.id) {
        try {
          await syncAppleHealthIfConnected(user.id, { force: true, days: 7 });
        } catch {}
      }
      await refresh();
      if (standalone) await Promise.all([refreshSummary(), refreshLibrary()]);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [refresh, refreshLibrary, refreshSummary, standalone, user?.id]);
  const openTdee = useCallback(() => {
    navigation.navigate('TDEECalculator');
  }, [navigation]);

  const stats = useMemo(
    () => standalone
      ? [
          { label: 'WORKOUTS', value: hasUser && fitnessSummary.monthWorkouts > 0 ? String(fitnessSummary.monthWorkouts) : 'Start one' },
          { label: 'WEIGHT', value: hasUser ? fitnessSummary.weightDisplay ?? 'Log yours' : 'Log yours' },
          { label: 'STEPS', value: hasUser ? fitnessSummary.stepsDisplay ?? 'Connect' : 'Connect' },
          {
            label: 'ACTIVE TODAY',
            value: hasUser ? fitnessSummary.activeDisplay ?? 'Get moving' : 'Get moving',
          },
        ]
      : [
          { label: 'WORKOUTS', value: hasUser && data && data.monthWorkouts > 0 ? String(data.monthWorkouts) : 'Start one' },
          { label: 'WEIGHT', value: data?.weightDisplay ?? 'Log yours' },
          { label: 'LAST SESSION', value: data?.featuredWorkoutMeta ?? 'Log one' },
          {
            label: 'ACTIVE',
            value: hasUser && (data?.activeTodayMin ?? 0) > 0 ? `${data?.activeTodayMin} min` : 'Get moving',
          },
        ],
    [data, fitnessSummary, hasUser, standalone],
  );

  return (
    <PillarScreen
      loading={loading && !data}
      preserveContentOnRefresh
      skeleton={<PillarSkeleton cards={3} />}
      refreshing={refreshing}
      onRefresh={hasUser ? onRefresh : undefined}
      error={data ? null : error}
      errorMessage="We couldn't bring in your body, activity and nutrition data. Try again in a moment."
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <GlobalErrorToastReporter message={data?.scoreError} />
      <GlobalErrorToastReporter message={workoutLibraryOpen ? null : fitnessLibrary.error} />
      <FadeInView>
        {standalone ? (
          <View>
            <ScreenHero
              eyebrow="Today's workout"
              headline={'Body\nand nutrition'}
            />
          </View>
        ) : (
          <ScreenHero eyebrow="Body" headline={"Today's\nworkout"} />
        )}
      </FadeInView>

      <PillarScoreRow
        pillar="Body"
        score={data?.bodyScore ?? null}
        trend={data?.bodyWeekChange ?? null}
        scoreUnavailable={Boolean(data?.scoreError)}
        baselineBuilding={Boolean(data && !data.scoreError && !data.baselineAvailable)}
      />
      <ManualActivitySection pillar="body" userId={user?.id} />

      <FadeInView delay={90}>
        <View className="flex-row items-center justify-between gap-sm mb-md">
          <SectionHeader title="Body this week" className="flex-shrink" />
          {standalone && fitnessSummary.latestLoggedDate ? (
            <Text className="font-heading-semibold text-tertiary-text text-[11px] tracking-[1px] uppercase text-right">
              Last logged {fitnessSummary.latestLoggedDate}
            </Text>
          ) : null}
        </View>
        <FlatSection>
          <MiniBarChart
            values={data?.bodyWeekSeries ?? EMPTY_BODY_WEEK}
            labels={MOOD_WEEK_LABELS}
            maxValue={4}
            height={72}
          />
          {data && data.bodyWeekSeries.every((value) => value === 0) ? (
            <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-sm">
              Your weekly activity will appear here as you complete workouts.
            </Text>
          ) : null}
        </FlatSection>
      </FadeInView>

      <FadeInView delay={110}>
        <View className="gap-sm">
          <View className="flex-row gap-sm">
            <StatCard value={stats[0].value} label={stats[0].label} />
            <StatCard value={stats[1].value} label={stats[1].label} />
          </View>
          <View className="flex-row gap-sm">
            <StatCard value={stats[2].value} label={stats[2].label} />
            <StatCard value={stats[3].value} label={stats[3].label} />
          </View>
        </View>
      </FadeInView>

      {standalone && hasUser && fitnessSummary.monthWorkouts > 0 && trendsAccess === false ? (
        <FadeInView delay={115}>
          <ProUpgradeSection
            moment={PRO_MOMENTS.progressTrends}
            source="progressTrends"
            feature="trends"
            userId={user?.id}
            lead={`${fitnessSummary.monthWorkouts} ${fitnessSummary.monthWorkouts === 1 ? 'workout' : 'workouts'} logged this month. Want to see how your Body score has changed?`}
            onPress={() => navigateToProSubscription(navigation, 'progressTrends', 'Body progress trends', user?.id, 'lock', 'trends')}
            size="sm"
          />
        </FadeInView>
      ) : null}

      <FadeInView delay={120}>
        {standalone ? (
          <FlatSection className="gap-md">
            <View className="flex-row items-start justify-between gap-md">
              <View className="flex-1">
                <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                  {workoutLibraryAccess === true ? 'Available workout' : 'Your workout this week'}
                </Text>
                <Text className="font-heading text-white text-[28px] leading-[30px] uppercase mt-xs">
                  {workoutName}
                </Text>
                <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-sm">
                  {selectedWorkout
                    ? workoutMeta
                    : fitnessLibrary.assignmentKnown
                      ? 'No workout has been assigned yet. Check back after Admin schedules this week’s workout.'
                      : fitnessLibrary.isOffline ? 'This week’s workout is not available offline yet.' : null}
                </Text>
              </View>
              {selectedWorkout ? <TagPill label={FOCUS_LABEL[selectedWorkout.focus]} /> : null}
            </View>
            {!selectedWorkout && !fitnessLibrary.assignmentKnown && fitnessLibrary.loading ? (
              <PillarSkeleton cards={1} />
            ) : null}
            {fitnessLibrary.error ? (
              <View className="gap-xs">
                <Text className="font-body text-muted-text text-[12px]">Could not update this week’s workout.</Text>
                <Pressable onPress={() => void refreshLibrary()} disabled={fitnessLibrary.loading || fitnessLibrary.isOffline}
                  accessibilityRole="button" accessibilityLabel="Retry weekly workout"
                  accessibilityState={{ disabled: fitnessLibrary.loading || fitnessLibrary.isOffline }}
                  className="self-start min-h-[44px] justify-center">
                  <Text className="font-body-semibold text-lime text-[13px]">Try again</Text>
                </Pressable>
              </View>
            ) : null}
            {selectedWorkout ? (
              <LimeButton label="Start workout →" onPress={hasUser ? openActiveWorkout : requireAuth} />
            ) : null}
          </FlatSection>
        ) : data?.featuredWorkoutTitle ? (
          <FlatSection className="gap-sm">
            <Text className="font-heading-bold text-white text-[18px] tracking-[0.5px] uppercase">
              {data.featuredWorkoutTitle}
            </Text>
            <Text className="font-body text-muted-text text-[14px] leading-[18px]">
              {data.featuredWorkoutMeta ?? 'Latest logged session'}
            </Text>
          </FlatSection>
        ) : (
          <FlatSection>
            <Text className="font-body text-muted-text text-[14px] leading-[19px]">
              Log your first workout to populate this card.
            </Text>
          </FlatSection>
        )}
      </FadeInView>

            {standalone ? (
        <FadeInView delay={165}>
          <View>
            <Pressable
              onPress={() => setWorkoutLibraryOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open Workout Library"
              className="flex-row items-center gap-md border-b border-border py-md"
            >
              <MaterialCommunityIcons name="dumbbell" size={23} color={colors.lime} />
              <View className="flex-1">
                <Text className="font-heading-bold text-white text-[16px] uppercase">Workout Library</Text>
                <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-xs">
                  Browse all available workouts
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.lime} />
            </Pressable>
          </View>
        </FadeInView>
      ) : null}

      {standalone ? (
        <Modal
          visible={workoutLibraryOpen}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setWorkoutLibraryOpen(false)}
        >
          <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-dark">
            <View className="flex-row items-center justify-between border-b border-border px-lg pb-md" style={{ paddingTop: 48 }}>
              <View className="flex-1">
                <Text className="font-heading-bold text-white text-[22px] uppercase">Workout Library</Text>
              </View>
              <Pressable
                onPress={() => setWorkoutLibraryOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close Workout Library"
                hitSlop={12}
                className="h-11 w-11 items-center justify-center rounded-full border border-border"
              >
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}>
              <View className="flex-row items-center justify-between gap-sm mb-md">
                <Text className="font-heading-bold text-muted-text text-[11px] tracking-[1px] uppercase flex-1">
                  {!hasUser ? 'Log in to view available workouts' : workoutLibraryAccess === true ? 'All available workouts' : workoutLibraryAccess === false ? 'Free and featured workouts' : 'Checking access'}
                </Text>
                {hasUser && libraryEmptyKnown ? <TagPill label={`${availableWorkouts.length} shown`} tone="outline" /> : null}
              </View>
              {availableWorkouts.length === 0 ? (
                !hasUser ? (
                  <Text className="font-body text-muted-text">Log in to see workouts available to your account.</Text>
                ) : workoutLibraryAccess === null ? null : fitnessLibrary.loading ? (
                  <View className="gap-sm py-sm">
                    {[0, 1, 2].map((item) => <View key={item} className="h-[64px] rounded-button bg-white/5" />)}
                  </View>
                ) : libraryProblem ? null : (
                  <View className="py-md">
                    <Text className="font-body text-muted-text text-[14px] leading-[19px]">
                      {fitnessLibrary.isOffline
                        ? 'No saved workouts are available here. Connect to the internet and try again.'
                        : !libraryEmptyKnown
                          ? 'Your workout library could not be confirmed. Please try again.'
                          : workoutLibraryAccess === false
                            ? 'No Free workouts are available yet.'
                            : 'No workouts are available yet.'}
                    </Text>
                    {!fitnessLibrary.isOffline && !libraryEmptyKnown ? <LimeButton label="Retry" onPress={() => void refreshLibrary()} /> : null}
                  </View>
                )
              ) : (
                <View className="gap-sm">
                  {availableWorkouts.map((workout) => {
                    const selected = selectedWorkout?.id === workout.id;
                    return (
                      <Pressable
                        key={workout.id}
                        onPress={() => {
                          setSelectedWorkoutId(workout.id);
                          setWorkoutLibraryOpen(false);
                          navigation.navigate('ActiveWorkout', { workoutId: workout.id });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${workout.title}`}
                        accessibilityState={{ selected }}
                        className={`rounded-button border p-md active:opacity-80 ${
                          selected ? 'border-lime bg-lime/10' : 'border-border bg-dark/30'
                        }`}
                      >
                        <Text className="font-heading-bold text-white text-[15px] tracking-[0.5px] uppercase">
                          {workout.title}
                        </Text>
                        <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-xs">
                          {workout.duration_mins} min · {EQUIPMENT_LABEL[workout.equipment]} · {FOCUS_LABEL[workout.focus]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
      {standalone ? (
        <FadeInView delay={190}>
          {aiWorkoutAccess === true ? (
            <FlatSection className="gap-md">
              <View className="flex-row items-start justify-between gap-md">
                <View className="flex-1">
                  <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                    AI workout
                  </Text>
                  <Text className="font-heading text-white text-[28px] leading-[30px] uppercase mt-xs">
                    Built around your day
                  </Text>
                  <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-sm">
                    Choose your time, equipment and focus. Generate a workout you can start immediately.
                  </Text>
                </View>
                {entitlement.trialActive === true ? <ProBadge variant="trial" /> : null}
              </View>
              <LimeButton
                label={generatedWorkout ? 'View workout' : 'Generate workout'}
                onPress={openAIWorkout}
              />
            </FlatSection>
          ) : aiWorkoutAccess === false ? (
            <BodyProLockedCard
              eyebrow="AI Workout"
              title="Built around your day."
              description="Choose your time, equipment and focus. Generate a workout you can start immediately."
              preview={require('../assets/body-ai-workout-blurred-preview.png')}
              previewLabel="Blurred preview of Pro AI workout features"
              source="aiWorkout"
              feature="ai_workout"
              userId={user?.id}
              buttonLabel="Unlock AI workouts →"
              onUnlock={() => navigateToProSubscription(navigation, 'aiWorkout', 'AI Workout', user?.id, 'lock', 'ai_workout')}
            />
          ) : !hasUser ? (
            <BodyProLockedCard
              eyebrow="AI Workout"
              title="Built around your day."
              description="Choose your time, equipment and focus. Generate a workout you can start immediately."
              preview={require('../assets/body-ai-workout-blurred-preview.png')}
              previewLabel="Blurred preview of Pro AI workout features"
              source="aiWorkout"
              feature="ai_workout"
              buttonLabel="Log in to continue →"
              trackLockView={false}
              onUnlock={requireAuth}
            />
          ) : (
  <FlatSection className="gap-md">
    <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
      AI workout
    </Text>
    <Text className="font-heading text-white text-[28px] leading-[30px] uppercase">
      Built around your day
    </Text>
    <Text className="font-body text-muted-text text-[14px] leading-[18px]">
      Choose your time, equipment and focus. Generate a workout you can start immediately.
    </Text>
    <InlineFormError
      message={accessCheckAttempted ? entitlement.verificationMessage : null}
    />
    <LimeButton
      label="Generate workout"
      onPress={() => void checkEntitlement()}
      loading={loading}
    />
  </FlatSection>
)}
        </FadeInView>
      ) : null}

      {standalone ? (
        <FadeInView delay={225}>
          {mealPlannerAccess === true ? (
            <FlatSection className="gap-md">
              <View className="flex-row items-start justify-between gap-md">
                <View className="flex-1">
                  <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Meal planner</Text>
                  <Text className="font-heading text-white text-[28px] leading-[30px] uppercase mt-xs">Eat like you train</Text>
                  <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-sm">
                    A personalised 5-day plan with recipes, macros and a shopping list — built around your goals.
                  </Text>
                </View>
                {entitlement.trialActive === true ? <ProBadge variant="trial" /> : null}
              </View>
              <LimeButton label="Open meal planner" onPress={openMealPlanner} />
            </FlatSection>
          ) : mealPlannerAccess === false ? (
            <BodyProLockedCard
              eyebrow="Meal Planner"
              title="Eat like you train."
              description="A personalised 5-day plan with recipes, macros and a shopping list — built around your goals."
              preview={require('../assets/body-meal-planner-blurred-preview.png')}
              previewLabel="Blurred decorative day-of-meals preview"
              source="meal_planner"
              feature="meal_planner"
              userId={user?.id}
              buttonLabel="Unlock meal planner →"
              onUnlock={() => navigateToProSubscription(navigation, 'meal_planner', 'Meal Planner', user?.id, 'lock')}
            />
          ) : !hasUser ? (
            <BodyProLockedCard
              eyebrow="Meal Planner"
              title="Eat like you train."
              description="A personalised 5-day plan with recipes, macros and a shopping list — built around your goals."
              preview={require('../assets/body-meal-planner-blurred-preview.png')}
              previewLabel="Blurred decorative day-of-meals preview"
              source="meal_planner"
              feature="meal_planner"
              buttonLabel="Log in to continue →"
              trackLockView={false}
              onUnlock={requireAuth}
            />
          ) : (
            <FlatSection className="gap-md">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                Meal planner
              </Text>
              <Text className="font-heading text-white text-[28px] leading-[30px] uppercase">
                Eat like you train
              </Text>
              <Text className="font-body text-muted-text text-[14px] leading-[18px]">
                A personalised 5-day plan with recipes, macros and a shopping list — built around your goals.
              </Text>
              <InlineFormError
                message={accessCheckAttempted ? entitlement.verificationMessage : null}
              />
              <LimeButton
                label="Open meal planner"
                onPress={() => void checkEntitlement()}
                loading={loading}
              />
            </FlatSection>
          )}
        </FadeInView>
      ) : null}

      {standalone && workoutLibraryAccess === false ? (
        <FadeInView delay={230}>
          <ProUpgradeSection
            moment={PRO_LOCKS.trainingPlans}
            source="workout_library"
            feature="workout_library"
            userId={user?.id}
            onPress={() => navigateToProSubscription(navigation, 'workout_library', 'Workout library', user?.id, 'lock')}
            size="sm"
          />
        </FadeInView>
      ) : null}

      <FadeInView delay={240}>
        <FlatSection className="gap-md">
          <View>
            <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
              Calorie calculator
            </Text>
            <Text className="font-heading text-white text-[28px] leading-[30px] uppercase mt-xs">
              Know your number
            </Text>
            <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-sm">
              Find the daily calories your body needs to perform, recover and feel like yourself.
            </Text>
          </View>
          <LimeButton label="Calculate →" onPress={openTdee} accessibilityLabel="Calculate daily calories" />
        </FlatSection>
      </FadeInView>

    </PillarScreen>
  );
}
