import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import BondScoreCard from '../components/bond/BondScoreCard';
import ManualActivitySection from '../components/manualActivities/ManualActivitySection';
import PresentDadMode from '../components/bond/PresentDadMode';
import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import GlobalErrorToastReporter from '../components/GlobalErrorToastReporter';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { colors } from '../theme';
import type { AppStackParamList } from '../navigation/AppNavigator';

export default function BondScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data, loading, error, refresh } = useDashboard(user?.id);
  const refreshInFlight = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const bondScore = useMemo(
    () => (typeof data?.bondScore === 'number' ? Math.round(data.bondScore) : null),
    [data?.bondScore],
  );

  const onRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try { await refresh(); } finally { refreshInFlight.current = false; setRefreshing(false); }
  }, [refresh]);

  const onViewBondScore = useCallback(() => {
    navigation.navigate('Tabs', {
      screen: 'Home',
      params: { openScoreDetail: true },
    });
  }, [navigation]);

  return (
    <PillarScreen
      loading={loading && !data}
      skeleton={<PillarSkeleton score cards={3} />}
      refreshing={refreshing}
      onRefresh={user?.id ? onRefresh : undefined}
      error={data ? null : error}
      errorMessage="We couldn't load your Bond tools. Please try again."
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <GlobalErrorToastReporter message={error} />
      <FadeInView>
        <ScreenHero eyebrow="The Bond" headline="Parenting" sub="Built for dads, by dads. Kill the old version of you." />
      </FadeInView>

      <FadeInView delay={90}>
        <BondScoreCard score={bondScore} trend={data?.bondWeekChange ?? null} />
        {bondScore == null || bondScore === 0 ? (
          <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-sm">
            Log a Bond activity below to start contributing to your score.
          </Text>
        ) : null}
      </FadeInView>

      <FadeInView delay={130}>
        <PresentDadMode userId={user?.id} onScoreRefresh={() => void refresh()} onViewBondScore={onViewBondScore} />
      </FadeInView>

      <FadeInView delay={180}>
        <Pressable
          onPress={() => navigation.navigate('DadDaysSearch')}
          accessibilityRole="button"
          accessibilityLabel="Find Dad Days near you"
          className="min-h-[86px] flex-row items-center gap-md rounded-button border border-lime/25 bg-lime/5 px-md py-md active:opacity-75"
        >
          <View className="h-[42px] w-[42px] rounded-full bg-lime items-center justify-center">
            <Feather name="map-pin" size={19} color={colors.dark} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="font-heading-bold text-white text-[17px] uppercase">Find Dad Days near you</Text>
            <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">Search by age, budget and distance.</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.lime} />
        </Pressable>
      </FadeInView>

      <FadeInView delay={230}>
        <View>
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase mb-md">Cook Together</Text>
          <Pressable onPress={() => navigation.navigate('CookTogether')} accessibilityRole="button" accessibilityLabel="Open Cook Together recipes" className="min-h-[92px] flex-row items-center gap-md rounded-button border border-lime/25 bg-card px-md py-md active:opacity-75">
            <View className="h-[42px] w-[42px] rounded-full bg-lime items-center justify-center"><Feather name="coffee" size={19} color={colors.dark} /></View>
            <View className="flex-1"><Text className="font-heading-bold text-white text-[17px] uppercase">Meals that matter</Text><Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">Cook with your kids and build connection.</Text></View>
            <Feather name="chevron-right" size={20} color={colors.lime} />
          </Pressable>
        </View>
      </FadeInView>

      <ManualActivitySection pillar="bond" userId={user?.id} />
    </PillarScreen>
  );
}
