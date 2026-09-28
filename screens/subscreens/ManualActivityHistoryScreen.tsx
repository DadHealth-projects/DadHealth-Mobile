import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ProLockedPreview from '../../components/ProLockedPreview';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { useManualActivityHistory } from '../../hooks/useManualActivityHistory';
import { fetchProInsight } from '../../lib/proInsights';
import { subscribeManualActivityChanges, manualActivityLabel, type ManualActivityPillar } from '../../lib/manualActivities';
import { PRO_MOMENTS } from '../../lib/proMoments';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type TrendPoint = { week_start: string; mind_manual_points: number; body_manual_points: number; bond_manual_points: number };

function ActivityTrendChart({ values, labels, locked = false }: { values: number[]; labels: string[]; locked?: boolean }) {
  const maximum = Math.max(70, ...values.filter(Number.isFinite));

  return (
    <View className="w-full gap-md" accessible={locked} accessibilityLabel={locked ? 'Weekly manual activity trend preview' : undefined}>
      <View className="flex-row justify-between">
        <Text className="font-body text-muted-text text-[11px]">Week starting</Text>
        <Text className="font-body text-muted-text text-[11px]">Manual activity points</Text>
      </View>
      {labels.map((label, index) => {
        const value = Number.isFinite(values[index]) ? Math.max(0, values[index]) : 0;
        return (
          <View key={`${label}-${index}`} className="flex-row items-center gap-sm" accessible={!locked} accessibilityLabel={locked ? undefined : `Week starting ${label}: ${value} manual activity points`}>
            <Text className="w-[48px] font-body text-muted-text text-[12px]">{label}</Text>
            <View className="h-[14px] flex-1 overflow-hidden rounded-full bg-muted">
              {!locked && value > 0 ? <View className="h-full rounded-full bg-lime" style={{ width: `${value / maximum * 100}%` }} /> : null}
            </View>
            <Text className="w-[48px] text-right font-body-semibold text-white text-[12px]">{locked ? '—' : `${Math.round(value)} pts`}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ManualActivityHistoryScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'ManualActivityHistory'>>();
  const { user } = useAuth();
  const { data } = useDashboard(user?.id);
  const pillar: ManualActivityPillar = route.params.pillar;
  const { activities, loading, error } = useManualActivityHistory(user?.id, pillar);
  const isPro = data?.isPro === true;
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(false);
  const trendRequest = useRef(0);

  const loadTrends = useCallback(async () => {
    const request = ++trendRequest.current;
    if (!user?.id || !isPro) {
      setPoints([]);
      setTrendLoading(false);
      setTrendError(false);
      return;
    }
    setTrendLoading(true);
    setTrendError(false);
    try {
      const response = await fetchProInsight<{ points: TrendPoint[] }>('manual-activity-trends');
      if (request !== trendRequest.current) return;
      if (!Array.isArray(response.points) || response.points.some((point) => !point || typeof point.week_start !== 'string')) {
        throw new Error('Invalid weekly trend');
      }
      setPoints(response.points);
      setTrendError(false);
    } catch {
      if (request !== trendRequest.current) return;
      setTrendError(true);
      setPoints([]);
    } finally {
      if (request === trendRequest.current) setTrendLoading(false);
    }
  }, [isPro, user?.id]);

  useEffect(() => {
    setPoints([]);
    void loadTrends();
    return () => { trendRequest.current += 1; };
  }, [loadTrends]);
  useEffect(() => subscribeManualActivityChanges(() => { void loadTrends(); }), [loadTrends]);

  const trendKey = `${pillar}_manual_points` as const;
  const values = points.map((point) => Number(point[trendKey] ?? 0));
  const labels = points.map((point) => point.week_start.slice(5));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-xl gap-lg">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
        <View className="gap-xs">
          <Text className="font-heading text-white text-[34px] uppercase">{pillar} activity</Text>
          <Text className="font-body text-muted-text text-[14px]">Your manual logs are available on Free and Pro.</Text>
        </View>

        {isPro ? (
          <View className="gap-md border-b border-border pb-lg">
            <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Manual activity trend · Pro</Text>
            {trendLoading ? <Text className="font-body text-muted-text text-[12px]">Loading weekly trend…</Text> : trendError ? (
              <View className="gap-sm">
                <Text accessibilityRole="alert" className="font-body text-muted-text text-[12px]">We couldn't load your weekly trend. Check your connection and try again.</Text>
                <Pressable onPress={() => void loadTrends()} accessibilityRole="button" accessibilityLabel="Retry weekly trend" className="min-h-[44px] self-start justify-center">
                  <Text className="font-heading-bold text-lime text-[12px] uppercase">Try again</Text>
                </Pressable>
              </View>
            ) : points.length ? (
              <ActivityTrendChart values={values} labels={labels} />
            ) : <Text className="font-body text-muted-text text-[12px]">Your weekly trend will appear as you log activities.</Text>}
          </View>
        ) : user ? (
          <ProLockedPreview
            lock={PRO_MOMENTS.progressTrends}
            onPress={() => navigation.navigate('ProSubscription')}
          >
            <ActivityTrendChart values={[]} labels={['W1', 'W2', 'W3', 'W4']} locked />
          </ProLockedPreview>
        ) : (
          <View className="gap-sm border-b border-border pb-lg">
            <Text className="font-body text-muted-text text-[13px]">Sign in to see your saved activity history and Pro trend preview.</Text>
            <LimeButton label="Log in" onPress={() => navigation.navigate('Login')} />
          </View>
        )}

        <View className="gap-md">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading-bold text-white text-[16px] uppercase">Logged activities</Text>
            <Pressable onPress={() => navigation.navigate('ManualActivityLog', { pillar })} accessibilityRole="button" className="min-h-[40px] flex-row items-center gap-xs px-sm active:opacity-70"><Feather name="plus" size={15} color={colors.lime} /><Text className="font-heading-bold text-lime text-[10px] uppercase">Log activity</Text></Pressable>
          </View>
          {loading ? <Text className="font-body text-muted-text text-[13px]">Loading your activity…</Text> : null}
          {error ? <Text className="font-body text-muted-text text-[13px]">{error}</Text> : null}
          {!loading && !activities.length ? <Text className="font-body text-muted-text text-[13px]">No manual activities logged yet.</Text> : null}
          {activities.map((activity) => {
            const minimum = pillar === 'mind' ? 5 : 15;
            const underMinimum = activity.duration_minutes != null && activity.duration_minutes < minimum;
            return (
              <View key={activity.id} className="gap-xs border-b border-border py-sm">
                <View className="flex-row items-start justify-between gap-sm">
                  <Text className="flex-1 font-heading-bold text-white text-[14px] uppercase">{manualActivityLabel(activity)}</Text>
                  <Text className="font-body text-muted-text text-[11px]">{activity.activity_date}</Text>
                </View>
                <Text className="font-body text-muted-text text-[12px]">
                  {[activity.duration_minutes != null ? `${activity.duration_minutes} min` : null, activity.intensity, activity.pillar === 'bond' ? activity.contact_day ? 'Contact day' : 'Non-contact' : null].filter(Boolean).join(' · ')}
                </Text>
                {underMinimum ? <Text className="font-body text-muted-text text-[11px]">Saved to history · below score minimum</Text> : null}
                {activity.notes ? <Text className="font-body text-muted-text text-[12px] leading-[18px]">{activity.notes}</Text> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
