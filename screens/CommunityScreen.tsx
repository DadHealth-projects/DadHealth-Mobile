import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';

import CircleCard from '../components/mockup/CircleCard';
import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import SectionHeader from '../components/dashboard/SectionHeader';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { dashboardIcon } from '../lib/dashboardIcons';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/analytics';
import { useCommunityFeed } from '../hooks/useCommunityFeed';
import { colors } from '../theme';
import type { AppStackParamList } from '../navigation/AppNavigator';

/**
 * Squad tab — the web dashboard COMMUNITY screen's features
 * (`dashboardPreview/CommunityScreen.tsx`: recent posts, dad circles) in
 * Mockup 4's layout: 2-column circles grid with join state, then feed posts.
 */
export default function CommunityScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data, loading, error, refresh } = useDashboard(user?.id);
  const feed = useCommunityFeed(user?.id);
  const [membersCount, setMembersCount] = useState(0);
  const [communityCircles, setCommunityCircles] = useState<Array<{ id: string; icon: string | null; name: string; members_count: number | null; joined: boolean }>>([]);
  const [circlesLoading, setCirclesLoading] = useState(true);
  const [circleError, setCircleError] = useState<string | null>(null);
  const [busyCircleId, setBusyCircleId] = useState<string | null>(null);
  const [liveSessions, setLiveSessions] = useState<Array<{ id: string; title: string; starts_at: string | null; host_name: string | null; summary: string | null }>>([]);
  const [liveSessionsLoading, setLiveSessionsLoading] = useState(true);
  const [liveSessionsError, setLiveSessionsError] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  const hasUser = Boolean(user?.id);
  const loadCircles = useCallback(async (silent = false) => {
    if (!silent) setCirclesLoading(true);
    setCircleError(null);
    const [circleResult, membershipResult] = await Promise.all([
      supabase.from('circles').select('id,icon,name,members_count'),
      user?.id ? supabase.from('user_circles').select('circle_id').eq('user_id', user.id) : Promise.resolve({ data: [], error: null }),
    ]);
    if (circleResult.error || membershipResult.error) setCircleError('We could not load Dad Circles. Please try again.');
    else {
      const joinedIds = new Set((membershipResult.data ?? []).map((row: { circle_id: string }) => row.circle_id));
      setCommunityCircles((circleResult.data ?? []).map((circle) => ({ id: String(circle.id), icon: typeof circle.icon === 'string' ? circle.icon : null, name: String(circle.name), members_count: typeof circle.members_count === 'number' ? circle.members_count : null, joined: joinedIds.has(String(circle.id)) })));
    }
    if (!silent) setCirclesLoading(false);
  }, [user?.id]);

  const loadLiveSessions = useCallback(async () => {
    setLiveSessionsLoading(true);
    setLiveSessionsError(null);
    const { data: sessions, error: sessionsError } = await supabase
      .from('live_sessions')
      .select('id,title,starts_at,host_name,summary')
      .order('starts_at', { ascending: true })
      .limit(10);
    if (sessionsError && ['42P01', 'PGRST205'].includes(sessionsError.code ?? '')) {
      setLiveSessions([]);
    } else if (sessionsError) {
      setLiveSessionsError('We could not load live sessions. Please try again.');
    } else {
      setLiveSessions((sessions ?? []).map((session) => ({ id: String(session.id), title: String(session.title), starts_at: typeof session.starts_at === 'string' ? session.starts_at : null, host_name: typeof session.host_name === 'string' ? session.host_name : null, summary: typeof session.summary === 'string' ? session.summary : null })));
    }
    setLiveSessionsLoading(false);
  }, []);

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    setTrendingError(null);
    const { data: trends, error: trendError } = await supabase.rpc('trending_post_tags', { limit_n: 5 });
    if (!trendError && Array.isArray(trends) && trends.length > 0) {
      setTrendingTags(trends.slice(0, 5).map((trend: { tag: unknown; count: unknown }) => ({ tag: `#${String(trend.tag).replace(/^#/, '')}`, count: Number(trend.count) || 0 })));
    } else if (feed.error) {
      setTrendingError('We could not load trending topics. Please try again.');
    } else {
      const counts = new Map<string, number>();
      feed.posts.forEach((post) => { if (post.tag) { const tag = `#${post.tag.replace(/^#/, '')}`; counts.set(tag, (counts.get(tag) ?? 0) + 1); } });
      setTrendingTags([...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 5));
    }
    setTrendingLoading(false);
  }, [feed.error, feed.posts]);

  const onRefresh = useCallback(() => { void Promise.all([refresh(), loadCircles(), feed.refresh(), loadLiveSessions(), loadTrending()]); }, [feed.refresh, loadCircles, loadLiveSessions, loadTrending, refresh]);
  const onToggleCircle = useCallback(async (circleId: string, joined: boolean) => {
    if (!user?.id || busyCircleId) return;
    setBusyCircleId(circleId); setCircleError(null);
    const result = joined
      ? await supabase.from('user_circles').delete().eq('user_id', user.id).eq('circle_id', circleId)
      : await supabase.from('user_circles').insert({ user_id: user.id, circle_id: circleId });
    if (result.error) setCircleError(`We could not ${joined ? 'leave' : 'join'} this circle. Please try again.`);
    else { if (!joined) trackEvent('circle_joined', { circle_id: circleId }, user.id); await loadCircles(true); }
    setBusyCircleId(null);
  }, [busyCircleId, loadCircles, user?.id]);

  useEffect(() => {
    let active = true;
    void supabase
      .from('user_profile')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (active) setMembersCount(count ?? 0); });
    return () => { active = false; };
  }, []);

  useEffect(() => { void loadTrending(); }, [loadTrending]);

  useEffect(() => { void loadCircles(); }, [loadCircles]);

  useEffect(() => { void loadLiveSessions(); }, [loadLiveSessions]);

  useFocusEffect(useCallback(() => { void Promise.all([refresh(), feed.refresh(true)]); }, [feed.refresh, refresh]));

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
        <ScreenHero
          eyebrow="Dad Health Community"
          headline="Community Feed"
        />
        <View className="mt-md flex-row items-center gap-sm">
          <View className="h-[7px] w-[7px] rounded-full bg-lime" />
          <Text className="font-heading-bold text-lime text-[11px] uppercase">
            {membersCount.toLocaleString()} members
          </Text>
        </View>
      </FadeInView>

      <FadeInView delay={90}>
        {circleError ? (
          <View className="gap-sm">
            <Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{circleError}</Text>
            <Pressable onPress={() => void loadCircles()}><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable>
          </View>
        ) : circlesLoading ? (
          <View className="flex-row flex-wrap gap-sm">{[0, 1, 2, 3].map((item) => <View key={item} className="h-[132px] w-[48%] rounded-card bg-white/5" />)}</View>
        ) : communityCircles.length === 0 ? (
          <Text className="font-body text-muted-text text-[14px]">No circles yet</Text>
        ) : (
          <View className="flex-row flex-wrap gap-sm">
            {communityCircles.map((circle) => (
              <View key={circle.id} className="w-[48%]">
                <CircleCard
                  id={circle.id}
                  leading={
                    <Feather
                      name={dashboardIcon(circle.icon ?? 'community')}
                      size={18}
                      color={colors.lime}
                    />
                  }
                  name={circle.name}
                  membersCount={circle.members_count}
                  joined={circle.joined}
                  onToggle={hasUser ? onToggleCircle : undefined}
                  busy={busyCircleId === circle.id}
                />
              </View>
            ))}
          </View>
        )}
      </FadeInView>

      <FadeInView delay={140}>
        <SectionHeader title="Recent posts" className="mb-md" />
        {feed.loading ? (
          <View className="h-[76px] rounded-button bg-white/5" />
        ) : feed.error ? (
          <View className="gap-sm">
            <Text className="font-body text-red-300 text-[13px]">Posts are unavailable.</Text>
            <Pressable onPress={() => void feed.refresh()} accessibilityRole="button">
              <Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('CommunityFeed')}
            accessibilityRole="button"
            accessibilityLabel={feed.posts.length === 0 ? 'No recent posts. Open community posts.' : `${feed.posts.length} recent posts available. View them now.`}
            className="min-h-[76px] flex-row items-center gap-md rounded-button border border-border bg-card px-md active:opacity-75"
          >
            <View className="h-[38px] w-[38px] rounded-full bg-lime/10 items-center justify-center">
              <Feather name="message-square" size={18} color={colors.lime} />
            </View>
            <View className="flex-1">
              <Text className="font-heading-bold text-white text-[15px] uppercase">
                {feed.posts.length === 0 ? 'No posts yet' : `${feed.posts.length} ${feed.posts.length === 1 ? 'post' : 'posts'} available`}
              </Text>
              <Text className="font-body text-muted-text text-[12px] mt-[2px]">
                {feed.posts.length === 0 ? 'Be the first to share with the squad.' : 'View them now'}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.lime} />
          </Pressable>
        )}
      </FadeInView>

      <FadeInView delay={180}>
        <SectionHeader title="Live sessions" className="mb-md" />
        {liveSessionsLoading ? <View className="gap-sm"><View className="h-[54px] border-y border-border bg-white/[0.02]" /><View className="h-[54px] border-b border-border bg-white/[0.02]" /></View> : liveSessionsError ? <View className="gap-sm"><Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{liveSessionsError}</Text><Pressable onPress={() => void loadLiveSessions()} accessibilityRole="button"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable></View> : liveSessions.length === 0 ? <Text className="font-body text-muted-text text-[13px]">No live sessions are scheduled yet.</Text> : <View>{liveSessions.map((session) => <View key={session.id} className="border-b border-border py-md gap-xs"><Text className="font-heading-bold text-lime text-[14px] uppercase">{session.title}</Text><Text className="font-body text-tertiary-text text-[11px]">{session.host_name ? `Host: ${session.host_name}` : 'Host TBD'}{session.starts_at ? ` · ${new Date(session.starts_at).toLocaleString()}` : ''}</Text>{session.summary ? <Text className="font-body text-tertiary-text text-[13px] leading-[19px] mt-xs">{session.summary}</Text> : null}</View>)}</View>}
        <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} accessibilityRole="button" className="self-start min-h-[40px] justify-center mt-md border-b border-lime"><Text className="font-heading-bold text-lime text-[11px] uppercase">View Pro</Text></Pressable>
      </FadeInView>

      <FadeInView delay={210}>
        <SectionHeader title="Trending" className="mb-md" />
        {trendingLoading ? <View className="gap-sm"><View className="h-[42px] border-y border-border bg-white/[0.02]" /><View className="h-[42px] border-b border-border bg-white/[0.02]" /></View> : trendingError ? <View className="gap-sm"><Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{trendingError}</Text><Pressable onPress={() => void loadTrending()} accessibilityRole="button"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable></View> : trendingTags.length === 0 ? <Text className="font-body text-muted-text text-[13px]">No trending tags yet.</Text> : <View>{trendingTags.map((trend) => <View key={trend.tag} className="min-h-[42px] flex-row items-center justify-between border-b border-border"><Text className="font-heading-bold text-lime text-[14px]">{trend.tag}</Text><Text className="font-heading-bold text-tertiary-text text-[11px]">{trend.count}</Text></View>)}</View>}
      </FadeInView>
    </PillarScreen>
  );
}
