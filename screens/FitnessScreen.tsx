import React, { useCallback, useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import Card from '../components/Card';
import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import MiniBarChart from '../components/dashboard/MiniBarChart';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import SectionHeader from '../components/dashboard/SectionHeader';
import StatCard from '../components/dashboard/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { MOOD_WEEK_LABELS } from '../lib/dashboard.utils';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://dadhealth.co.uk';

const EMPTY_BODY_WEEK = [0, 0, 0, 0, 0, 0, 0];

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
  const { data, loading, error, refresh } = useDashboard(user?.id);

  const hasUser = Boolean(user?.id);
  const onRefresh = useCallback(() => void refresh(), [refresh]);
  const openTdee = useCallback(() => {
    void Linking.openURL(`${WEB_URL}/fitness#tdee`).catch(() => {});
  }, []);

  const stats = useMemo(
    () => [
      { label: 'WORKOUTS', value: hasUser && data ? String(data.monthWorkouts) : '0' },
      { label: 'WEIGHT', value: data?.weightDisplay ?? '0' },
      { label: 'LAST SESSION', value: data?.featuredWorkoutMeta ?? '0' },
      {
        label: 'ACTIVE',
        value: hasUser && (data?.activeTodayMin ?? 0) > 0 ? `${data?.activeTodayMin} min` : '0',
      },
    ],
    [data, hasUser],
  );

  return (
    <PillarScreen
      loading={loading && !data}
      skeleton={<PillarSkeleton cards={3} />}
      refreshing={loading}
      onRefresh={hasUser ? onRefresh : undefined}
      error={data ? null : error}
      onRetry={onRefresh}
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <FadeInView>
        <ScreenHero eyebrow="Fitness" headline={"Today's\nworkout"} />
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

      <FadeInView delay={140}>
        {data?.featuredWorkoutTitle ? (
          <Card className="border-lime/25 gap-sm">
            <Text className="font-heading-bold text-white text-[18px] tracking-[0.5px] uppercase">
              {data.featuredWorkoutTitle}
            </Text>
            <Text className="font-body text-white/45 text-[12px] leading-[18px]">
              {data.featuredWorkoutMeta ?? 'Latest logged session'}
            </Text>
          </Card>
        ) : (
          <Card className="border-lime/25">
            <Text className="font-body text-white/50 text-[13px] leading-[19px]">
              Log your first workout to populate this card.
            </Text>
          </Card>
        )}
      </FadeInView>

      <FadeInView delay={190}>
        <Card className="border-lime/25 gap-sm">
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
            Know your daily calories
          </Text>
          <Text className="font-body text-white/45 text-[12px] leading-[18px]">
            Calculate your TDEE and discover the exact calories you need to maintain, lose, or gain
            weight — built for busy dads.
          </Text>
          <Pressable
            onPress={openTdee}
            accessibilityRole="button"
            accessibilityLabel="Calculate TDEE"
            className="self-start rounded-button bg-lime px-md py-sm mt-xs active:opacity-90"
          >
            <Text className="font-heading-bold text-dark text-[11px] tracking-[1px] uppercase">
              Calculate TDEE →
            </Text>
          </Pressable>
        </Card>
      </FadeInView>

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
    </PillarScreen>
  );
}
