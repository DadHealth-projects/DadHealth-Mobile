import React, { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/Card';
import type { DashboardSection } from '../components/AccountSheet';
import AppTopBar from '../components/AppTopBar';
import DadScoreCard from '../components/dashboard/DadScoreCard';
import DashboardErrorCard from '../components/dashboard/DashboardErrorCard';
import FadeInView from '../components/FadeInView';
import ProgressSkeleton from '../components/skeleton/ProgressSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import SectionHeader from '../components/dashboard/SectionHeader';
import StatCard from '../components/dashboard/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { CAPS } from '../lib/dashboardCaps';
import {
  getDashboardScore,
  getReportStatsList,
  getScoreBreakdown,
} from '../lib/dashboard.utils';
import { colors } from '../theme';

/**
 * Progress — the web dashboard PROGRESS screen's features
 * (`dashboardPreview/ProgressScreen.tsx`: score card, `{MONTH} REPORT` stats,
 * badges), in the mockups' native layout. Pushed from the dashboard's
 * "Take action" button, so it keeps a close control.
 */
export default function ProgressScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const navigation = useNavigation<{ goBack: () => void }>();
  const { user } = useAuth();
  const { data, loading, error, refresh } = useDashboard(user?.id);

  const onRefresh = useCallback(() => void refresh(), [refresh]);
  const onClose = useCallback(() => navigation.goBack(), [navigation]);

  const score = useMemo(
    () =>
      getDashboardScore(
        {
          total_score: data?.totalScore ?? null,
          mind_score: data?.mindScore ?? null,
          body_score: data?.bodyScore ?? null,
          bond_score: data?.bondScore ?? null,
        },
        Boolean(data),
      ),
    [data],
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

  const reportStats = useMemo(() => getReportStatsList(data?.reportStats), [data?.reportStats]);
  const badges = useMemo(() => (data?.badges ?? []).slice(0, CAPS.badges), [data?.badges]);
  const monthLabel = useMemo(
    () => new Date().toLocaleDateString('en-GB', { month: 'long' }).toUpperCase(),
    [],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl"
        refreshControl={
          user?.id ? (
            <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.lime} />
          ) : undefined
        }
      >
        <AppTopBar
          showNavigation={Boolean(dashboardSection)}
          activeSection={dashboardSection}
          onSelectSection={onSelectDashboardSection}
          rightAccessory={dashboardSection ? undefined : (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          )}
        />

        {loading && !data ? (
          <ProgressSkeleton />
        ) : error && !data ? (
          <DashboardErrorCard message={error} onRetry={onRefresh} />
        ) : (
          <>
            <FadeInView>
              <ScreenHero eyebrow="Progress" headline={'Your Dad\nHealth score'} />
            </FadeInView>

            <FadeInView delay={90}>
              <DadScoreCard score={score} items={scoreItems} scoreLabel="out of 100" title="" />
            </FadeInView>

            <FadeInView delay={140}>
              <SectionHeader title={`${monthLabel} report`} className="mb-md" />
              <View className="flex-row gap-sm">
                {reportStats.map(([value, label]) => (
                  <StatCard key={label} value={value} label={label} />
                ))}
              </View>
            </FadeInView>

            <FadeInView delay={190}>
              <SectionHeader title="Badges" className="mb-md" />
              {badges.length === 0 ? (
                <Card>
                  <Text className="font-body text-white/50 text-[13px] leading-[19px]">
                    Earn badges by logging workouts, moods, and milestones.
                  </Text>
                </Card>
              ) : (
                <View className="flex-row flex-wrap gap-sm">
                  {badges.map((badge) => (
                    <View
                      key={badge.name}
                      accessibilityLabel={badge.name}
                      className="h-[52px] w-[52px] rounded-card border border-lime/20 bg-lime/[0.04] items-center justify-center"
                    >
                      <Text className="text-[22px]">{badge.icon}</Text>
                    </View>
                  ))}
                </View>
              )}
            </FadeInView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
