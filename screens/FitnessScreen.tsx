import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';

import Card from '../components/Card';
import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import LimeButton from '../components/LimeButton';
import MiniBarChart from '../components/dashboard/MiniBarChart';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import SectionHeader from '../components/dashboard/SectionHeader';
import StatCard from '../components/dashboard/StatCard';
import TagPill from '../components/dashboard/TagPill';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { useFitnessLibrary } from '../hooks/useFitnessLibrary';
import { useFitnessSummary } from '../hooks/useFitnessSummary';
import { MOOD_WEEK_LABELS } from '../lib/dashboard.utils';
import { DAD_STRENGTH_MOVES } from '../lib/homeContent';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { syncAppleHealthIfConnected } from '../lib/appleHealth';

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
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const standalone = !dashboardSection;
  const { data, loading, error, refresh } = useDashboard(user?.id);
  const { data: fitnessSummary, loading: summaryLoading, refresh: refreshSummary } = useFitnessSummary(
    standalone ? user?.id : undefined,
  );
  const fitnessLibrary = useFitnessLibrary(user?.id, standalone);
  const refreshLibrary = fitnessLibrary.refresh;
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const selectedWorkout = useMemo(
    () => fitnessLibrary.workouts.find((workout) => workout.id === selectedWorkoutId)
      ?? fitnessLibrary.workouts[0]
      ?? null,
    [fitnessLibrary.workouts, selectedWorkoutId],
  );
  const moveCount = selectedWorkout?.exercises.length || DAD_STRENGTH_MOVES.length;

  const hasUser = Boolean(user?.id);
  const requireAuth = useCallback(() => navigation.navigate('Login'), [navigation]);
  const openActiveWorkout = useCallback(
    () => navigation.navigate('ActiveWorkout', selectedWorkout?.id ? { workoutId: selectedWorkout.id } : undefined),
    [navigation, selectedWorkout?.id],
  );
  const generatedWorkout = useMemo(
    () => fitnessLibrary.workouts.find((workout) => workout.source === 'ai_generated') ?? null,
    [fitnessLibrary.workouts],
  );
  const openAIWorkout = useCallback(
    () => navigation.navigate('AIWorkout', generatedWorkout ? { workoutId: generatedWorkout.id } : undefined),
    [generatedWorkout, navigation],
  );
  const openMealPlanner = useCallback(() => navigation.navigate('MealPlanner'), [navigation]);
  const onRefresh = useCallback(() => {
    void (async () => {
      if (user?.id) {
        try {
          await syncAppleHealthIfConnected(user.id, { force: true, days: 7 });
        } catch {}
      }
      await refresh();
      if (standalone) await Promise.all([refreshSummary(), refreshLibrary()]);
    })();
  }, [refresh, refreshLibrary, refreshSummary, standalone, user?.id]);

  useFocusEffect(useCallback(() => {
    if (standalone) onRefresh();
  }, [onRefresh, standalone]));
  const openTdee = useCallback(() => {
    navigation.navigate('TDEECalculator');
  }, [navigation]);

  const stats = useMemo(
    () => standalone
      ? [
          { label: 'WORKOUTS', value: hasUser ? String(fitnessSummary.monthWorkouts) : '0' },
          { label: 'WEIGHT', value: hasUser ? fitnessSummary.weightDisplay : '0' },
          { label: 'STEPS', value: hasUser ? fitnessSummary.stepsDisplay : '0' },
          {
            label: 'ACTIVE TODAY',
            value: hasUser ? fitnessSummary.activeDisplay : '0 min',
          },
        ]
      : [
          { label: 'WORKOUTS', value: hasUser && data ? String(data.monthWorkouts) : '0' },
          { label: 'WEIGHT', value: data?.weightDisplay ?? '0' },
          { label: 'LAST SESSION', value: data?.featuredWorkoutMeta ?? '0' },
          {
            label: 'ACTIVE',
            value: hasUser && (data?.activeTodayMin ?? 0) > 0 ? `${data?.activeTodayMin} min` : '0',
          },
        ],
    [data, fitnessSummary, hasUser, standalone],
  );

  return (
    <PillarScreen
      loading={(loading && !data) || (standalone && summaryLoading)}
      skeleton={<PillarSkeleton cards={3} />}
      refreshing={loading}
      onRefresh={hasUser ? onRefresh : undefined}
      error={data ? null : error}
      errorTitle="Body didn't load"
      errorMessage="We couldn't bring in your fitness, activity and nutrition data. Try again in a moment."
      onRetry={onRefresh}
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <FadeInView>
        {standalone ? (
          <View>
            <ScreenHero
              eyebrow="Today's workout"
              headline={'Fitness\nand nutrition'}
              sub={`${moveCount} moves · workout + meal planner hub`}
            />
            {fitnessSummary.latestLoggedDate ? (
              <Text className="font-heading-semibold text-tertiary-text text-[11px] tracking-[1px] uppercase mt-sm">
                Last logged {fitnessSummary.latestLoggedDate}
              </Text>
            ) : null}
          </View>
        ) : (
          <ScreenHero eyebrow="Fitness" headline={"Today's\nworkout"} />
        )}
      </FadeInView>

      <FadeInView delay={90}>
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

      <FadeInView delay={120}>
        {standalone ? (
          <Card className="gap-md border-lime/25">
            <View className="flex-row items-start justify-between gap-md">
              <View className="flex-1">
                <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                  Active workout
                </Text>
                <Text className="font-heading text-white text-[28px] leading-[30px] uppercase mt-xs">
                  {selectedWorkout?.title ?? 'Dad Strength'}
                </Text>
                <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-sm">
                  {moveCount} moves
                  {selectedWorkout ? ` · ${selectedWorkout.duration_mins} min · ${EQUIPMENT_LABEL[selectedWorkout.equipment]}` : ''}
                </Text>
              </View>
              <TagPill label={selectedWorkout ? FOCUS_LABEL[selectedWorkout.focus] : 'Full body'} />
            </View>
            <LimeButton label="Start workout →" onPress={hasUser ? openActiveWorkout : requireAuth} />
          </Card>
        ) : data?.featuredWorkoutTitle ? (
          <Card className="border-lime/25 gap-sm">
            <Text className="font-heading-bold text-white text-[18px] tracking-[0.5px] uppercase">
              {data.featuredWorkoutTitle}
            </Text>
            <Text className="font-body text-muted-text text-[12px] leading-[18px]">
              {data.featuredWorkoutMeta ?? 'Latest logged session'}
            </Text>
          </Card>
        ) : (
          <Card className="border-lime/25">
            <Text className="font-body text-muted-text text-[13px] leading-[19px]">
              Log your first workout to populate this card.
            </Text>
          </Card>
        )}
      </FadeInView>

      {standalone ? (
        <FadeInView delay={140}>
          <SectionHeader title="Body this week" className="mb-md" />
          <Card>
            <MiniBarChart
              values={data?.bodyWeekSeries ?? EMPTY_BODY_WEEK}
              labels={MOOD_WEEK_LABELS}
              maxValue={4}
              height={72}
            />
          </Card>
        </FadeInView>
      ) : null}

      {standalone ? (
        <FadeInView delay={165}>
          <View>
            <SectionHeader title="Workout library" className="mb-md" />
            <Card className="gap-md">
              <View className="flex-row items-center justify-between gap-sm">
                <Text className="font-heading-bold text-muted-text text-[11px] tracking-[1px] uppercase">
                  {fitnessLibrary.proError ? 'Workout access unavailable' : fitnessLibrary.isPro ? 'All available workouts' : 'Free workouts (8 max)'}
                </Text>
                <TagPill label={`${fitnessLibrary.workouts.length} shown`} tone="outline" />
              </View>

              {fitnessLibrary.loading ? (
                <View className="gap-sm py-sm">
                  {[0, 1, 2].map((item) => <View key={item} className="h-[64px] rounded-button bg-white/5" />)}
                </View>
              ) : fitnessLibrary.error ? (
                <View accessibilityRole="alert" className="gap-md py-sm">
                  <Text className="font-body text-red-300 text-[13px] leading-[19px]">{fitnessLibrary.error}</Text>
                  <LimeButton label="Retry workouts" onPress={() => void fitnessLibrary.refresh()} />
                </View>
              ) : fitnessLibrary.workouts.length === 0 ? (
                <View className="py-md">
                  <Text className="font-body text-muted-text text-[13px] leading-[19px]">No workouts are available yet.</Text>
                </View>
              ) : (
                <View className="gap-sm">
                  {fitnessLibrary.workouts.map((workout) => {
                  const selected = selectedWorkout?.id === workout.id;
                  return (
                    <Pressable
                      key={workout.id}
                      onPress={() => setSelectedWorkoutId(workout.id)}
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
                      <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">
                        {workout.duration_mins} min · {EQUIPMENT_LABEL[workout.equipment]} · {FOCUS_LABEL[workout.focus]}
                      </Text>
                    </Pressable>
                  );
                  })}
                </View>
              )}
              {fitnessLibrary.proError ? (
                <View accessibilityRole="alert" className="gap-md border-t border-border pt-md">
                  <Text className="font-body text-red-300 text-[13px] leading-[19px]">{fitnessLibrary.proError}</Text>
                  <LimeButton label="Retry access" onPress={() => void fitnessLibrary.refresh()} />
                </View>
              ) : null}
            </Card>
          </View>
        </FadeInView>
      ) : null}

      {standalone ? (
        <FadeInView delay={190}>
          <Card className="gap-md border-lime/25">
            <View className="flex-row items-start justify-between gap-md">
              <View className="flex-1">
                <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                  AI workout
                </Text>
                <Text className="font-heading text-white text-[28px] leading-[30px] uppercase mt-xs">
                  Built around your day
                </Text>
                <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-sm">
                  Choose your time, equipment and focus. Generate a workout you can start immediately.
                </Text>
              </View>
              <TagPill label={fitnessLibrary.proError ? 'Unavailable' : fitnessLibrary.isPro ? 'Pro' : 'Free'} />
            </View>
            <LimeButton
              label={generatedWorkout ? 'View workout' : 'Generate workout'}
              onPress={openAIWorkout}
            />
          </Card>
        </FadeInView>
      ) : null}

      {standalone ? (
        <FadeInView delay={215}>
          <Card className="gap-md border-lime/25">
            <View className="flex-row items-start justify-between gap-md">
              <View className="flex-1">
                <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Meal planner</Text>
                <Text className="font-heading text-white text-[28px] leading-[30px] uppercase mt-xs">Fuel your whole week</Text>
                <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-sm">Generate a personalised 5-day plan with recipes, macros and a shopping list.</Text>
              </View>
              <TagPill label={fitnessLibrary.proError ? 'Unavailable' : fitnessLibrary.isPro ? 'Pro' : 'Preview'} />
            </View>
            <LimeButton label="Open meal planner" onPress={openMealPlanner} />
          </Card>
        </FadeInView>
      ) : null}

      <FadeInView delay={240}>
        <Card className="border-lime/25 gap-sm">
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
            {standalone ? 'Do you know your calories?' : 'Know your daily calories'}
          </Text>
          <Text className="font-body text-muted-text text-[12px] leading-[18px]">
            {standalone
              ? 'Find the daily calories your body needs.'
              : 'Calculate your TDEE and discover the exact calories you need to maintain, lose, or gain weight — built for busy dads.'}
          </Text>
          <Pressable
            onPress={openTdee}
            accessibilityRole="button"
            accessibilityLabel={standalone ? 'Calculate daily calories' : 'Calculate TDEE'}
            className="self-start rounded-button bg-lime px-md py-sm mt-xs active:opacity-90"
          >
            <Text className="font-heading-bold text-dark text-[11px] tracking-[1px] uppercase">
              {standalone ? 'Calculate' : 'Calculate TDEE →'}
            </Text>
          </Pressable>
        </Card>
      </FadeInView>

      {!standalone ? (
        <FadeInView delay={240}>
          <SectionHeader title="Body this week" className="mb-md" />
          <Card>
            <MiniBarChart
              values={data?.bodyWeekSeries ?? EMPTY_BODY_WEEK}
              labels={MOOD_WEEK_LABELS}
              maxValue={4}
              height={72}
            />
          </Card>
        </FadeInView>
      ) : null}

    </PillarScreen>
  );
}
