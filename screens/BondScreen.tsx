import { confirmNotificationPresentation } from '../lib/pushNotifications';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useIsFocused, type NavigationProp, type RouteProp } from '@react-navigation/native';
import type { BottomTabsParamList } from '../navigation/BottomTabNavigator';

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
  const route = useRoute<RouteProp<BottomTabsParamList, 'Bond'>>();
  const focused = useIsFocused();
  const suggestion = useRef<React.ElementRef<typeof View>>(null);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const revealTarget = useRef<{y:number;token:string|undefined;owner:string}|null>(null);
  const [suggestionLaidOut, setSuggestionLaidOut] = useState(false);
  const reveal = route.name === 'Bond' && route.params?.revealPresentDad === true;
  const bondNavigation = useNavigation<NavigationProp<BottomTabsParamList, 'Bond'>>();
  useEffect(() => {
    if (!focused || !reveal || !user?.id || !suggestionLaidOut) return;
    // Reveal the existing control only. Never call PresentDadMode.open/start.
    const content = scrollRef.current?.getInnerViewRef();
    if (!content) return;
    let active = true;
    suggestion.current?.measureLayout(content, (_x, y) => {
      if (!active) return;
      const targetY = Math.max(0, y - 16);
      revealTarget.current={y:targetY,token:route.params?.notificationOperation,owner:user.id};
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
      if(targetY===0) void confirmNotificationPresentation(route.params?.notificationOperation,user.id);
      bondNavigation.setParams({ revealPresentDad: undefined });
    });
    return () => { active = false; };
  }, [focused, reveal, user?.id, bondNavigation, suggestionLaidOut, route.params?.notificationOperation]);
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

  const clearOpenPresentDad = useCallback(
    () => bondNavigation.setParams({ openPresentDad: undefined }),
    [bondNavigation],
  );

  return (
    <PillarScreen
      scrollRef={scrollRef}
      onScroll={({nativeEvent})=>{
        const target=revealTarget.current;
        const maximum = Math.max(0, nativeEvent.contentSize.height-nativeEvent.layoutMeasurement.height);
        if(target && Math.abs(nativeEvent.contentOffset.y-Math.min(target.y,maximum))<2){
          revealTarget.current=null;
          void confirmNotificationPresentation(target.token,target.owner);
        }
      }}
      loading={loading && !data}
      skeleton={<PillarSkeleton score cards={3} />}
      refreshing={refreshing}
      onRefresh={user?.id ? onRefresh : undefined}
      error={data ? null : error}
      errorMessage="We couldn't load your Bond tools. Please try again."
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <GlobalErrorToastReporter message={data?.scoreError ?? error} />
      <FadeInView>
        <ScreenHero eyebrow="The Bond" headline="Parenting" sub="Built for dads, by dads. Kill the old version of you." />
      </FadeInView>

      <FadeInView delay={90}>
        <BondScoreCard
          score={bondScore}
          trend={data?.bondWeekChange ?? null}
          scoreUnavailable={Boolean(data?.scoreError)}
          baselineBuilding={Boolean(data && !data.scoreError && !data.baselineAvailable)}
        />
        <Pressable
          onPress={onViewBondScore}
          accessibilityRole="button"
          accessibilityLabel="View your report"
          className="self-start flex-row items-center gap-xs mt-md active:opacity-70"
        >
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">View your report</Text>
          <Feather name="arrow-right" size={15} color={colors.lime} />
        </Pressable>
        {data && !data.scoreError && (bondScore == null || bondScore === 0) ? (
          <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-sm">
            Log a Bond activity below to start contributing to your score.
          </Text>
        ) : null}
      </FadeInView>

      <FadeInView delay={130}>
        <View ref={suggestion} collapsable={false} onLayout={() => setSuggestionLaidOut(true)}>
          <PresentDadMode
            key={user?.id}
            userId={user?.id}
            onScoreRefresh={() => void refresh()}
            onViewBondScore={onViewBondScore}
            completionSessionId={route.name === 'Bond' ? route.params?.completedPresentDadSessionId : undefined}
            notificationOperation={route.name === 'Bond' ? route.params?.notificationOperation : undefined}
            openRequest={route.name === 'Bond' ? route.params?.openPresentDad : undefined}
            onOpenRequestHandled={clearOpenPresentDad}
          />
        </View>
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
            <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-xs">Search by age, budget and distance.</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.lime} />
        </Pressable>
      </FadeInView>

      <FadeInView delay={230}>
        <View>
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase mb-md">Cook Together</Text>
          <Pressable onPress={() => navigation.navigate('CookTogether')} accessibilityRole="button" accessibilityLabel="Open Cook Together recipes" className="min-h-[92px] flex-row items-center gap-md rounded-button border border-lime/25 bg-card px-md py-md active:opacity-75">
            <View className="h-[42px] w-[42px] rounded-full bg-lime items-center justify-center"><Feather name="coffee" size={19} color={colors.dark} /></View>
            <View className="flex-1"><Text className="font-heading-bold text-white text-[17px] uppercase">Meals that matter</Text><Text className="font-body text-muted-text text-[14px] leading-[18px] mt-xs">Cook with your kids and build connection.</Text></View>
            <Feather name="chevron-right" size={20} color={colors.lime} />
          </Pressable>
        </View>
      </FadeInView>

      <ManualActivitySection pillar="bond" userId={user?.id} />
    </PillarScreen>
  );
}
