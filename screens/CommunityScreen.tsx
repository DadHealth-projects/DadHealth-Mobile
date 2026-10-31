import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';

import CircleCard from '../components/mockup/CircleCard';
import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import ScreenErrorNotice from '../components/ScreenErrorNotice';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import SectionHeader from '../components/dashboard/SectionHeader';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { useDashboard } from '../hooks/useDashboard';
import { dashboardIcon } from '../lib/dashboardIcons';
import { supabase } from '../lib/supabase';
import { useCommunityFeed } from '../hooks/useCommunityFeed';
import { useCommunityPresence } from '../hooks/useCommunityPresence';
import { communityTagLabel } from '../lib/communityLabels';
import CommunityAuthorAvatar from '../components/community/CommunityAuthorAvatar';
import { loadCommunityAuthorAvatars } from '../lib/communityAuthorAvatars';
import { colors } from '../theme';
import type { AppStackParamList } from '../navigation/AppNavigator';

/**
 * Squad tab — the web dashboard COMMUNITY screen's features
 * (`dashboardPreview/CommunityScreen.tsx`: recent posts, dad circles) in
 * the approved full-width Circle layout.
 */
export default function CommunityScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const { user } = useAuth();
  const { isOffline } = useNetworkStatus();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data, loading, error, refresh } = useDashboard(user?.id);
  const feed = useCommunityFeed(user?.id);
  const onlinePresence = useCommunityPresence(user?.id);
  const [communityCircles, setCommunityCircles] = useState<Array<{ id: string; icon: string | null; name: string; description: string | null; members_count: number | null; visibility: 'public' | 'private'; joined: boolean }>>([]);
  const [circlesLoading, setCirclesLoading] = useState(true);
  const [circleError, setCircleError] = useState<string | null>(null);
  const [liveSessions, setLiveSessions] = useState<Array<{ id: string; title: string; starts_at: string | null; host_name: string | null; summary: string | null }>>([]);
  const [liveSessionsLoading, setLiveSessionsLoading] = useState(true);
  const [liveSessionsError, setLiveSessionsError] = useState<string | null>(null);
  const [trendingTags, setTrendingTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [trendingCirclePosts, setTrendingCirclePosts] = useState<Array<{ circle_id: string; circle_name: string; post_id: string; content: string; tag: string; anonymous: boolean; author_name: string; author_initials: string; avatar_url: string | null }>>([]);
  const [trendingCircleLoading, setTrendingCircleLoading] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [trendingCircleError, setTrendingCircleError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasUser = Boolean(user?.id);
  const loadCircles = useCallback(async (silent = false) => {
    if (!silent) setCirclesLoading(true);
    setCircleError(null);
    if (isOffline) { if (!silent) setCirclesLoading(false); return; }
    try {
      const [circleResult, membershipResult] = await Promise.all([
        supabase.from('circles').select('id,icon,name,description,members_count,visibility'),
        user?.id ? supabase.from('user_circles').select('circle_id').eq('user_id', user.id) : Promise.resolve({ data: [], error: null }),
      ]);
      if (circleResult.error || membershipResult.error) setCircleError('We could not load Dad Circles. Please try again.');
      else {
        const joinedIds = new Set((membershipResult.data ?? []).map((row: { circle_id: string }) => row.circle_id));
        setCommunityCircles((circleResult.data ?? []).map((circle) => ({ id: String(circle.id), icon: typeof circle.icon === 'string' ? circle.icon : null, name: String(circle.name), description: typeof circle.description === 'string' ? circle.description : null, members_count: typeof circle.members_count === 'number' ? circle.members_count : null, visibility: circle.visibility === 'private' ? 'private' : 'public', joined: joinedIds.has(String(circle.id)) })));
      }
    } catch {
      setCircleError('We could not load Dad Circles. Please try again.');
    } finally { if (!silent) setCirclesLoading(false); }
  }, [isOffline, user?.id]);

  const loadLiveSessions = useCallback(async () => {
    setLiveSessionsLoading(true);
    setLiveSessionsError(null);
    if (isOffline) {
      setLiveSessionsLoading(false);
      return;
    }
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('live_sessions')
        .select('id,title,starts_at,host_name,summary')
        .order('starts_at', { ascending: true })
        .limit(10);
      if (sessionsError && ['42P01', 'PGRST205'].includes(sessionsError.code ?? '')) setLiveSessions([]);
      else if (sessionsError) setLiveSessionsError('We could not load live sessions. Please try again.');
      else setLiveSessions((sessions ?? []).map((session) => ({ id: String(session.id), title: String(session.title), starts_at: typeof session.starts_at === 'string' ? session.starts_at : null, host_name: typeof session.host_name === 'string' ? session.host_name : null, summary: typeof session.summary === 'string' ? session.summary : null })));
    } catch {
      setLiveSessionsError('We could not load live sessions. Please try again.');
    } finally { setLiveSessionsLoading(false); }
  }, [isOffline]);

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    setTrendingError(null);
    if (isOffline) {
      const counts = new Map<string, number>();
      feed.posts.forEach((post) => { if (post.tag) { const tag = communityTagLabel(`#${post.tag.replace(/^#/, '')}`); counts.set(tag, (counts.get(tag) ?? 0) + 1); } });
      setTrendingTags([...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 5));
      setTrendingLoading(false);
      return;
    }
    try {
      const { data: trends, error: trendError } = await supabase.rpc('trending_post_tags', { limit_n: 5 });
      if (trendError || !Array.isArray(trends)) {
        setTrendingError('We could not load trending topics. Please try again.');
        return;
      }
      setTrendingTags(trends.slice(0, 5).map((trend: { tag: unknown; count: unknown }) => ({ tag: communityTagLabel(`#${String(trend.tag).replace(/^#/, '')}`), count: Number(trend.count) || 0 })).sort((first, second) => second.count - first.count));
    } catch {
      setTrendingError('We could not load trending topics. Please try again.');
    } finally { setTrendingLoading(false); }
  }, [feed.error, feed.posts, isOffline]);

  const loadTrendingCirclePosts = useCallback(async () => {
    setTrendingCircleLoading(true);
    setTrendingCircleError(null);
    if (isOffline) { setTrendingCircleLoading(false); return; }
    try {
      const { data: rows, error: trendingError } = await supabase.rpc('get_trending_circle_posts');
      if (!trendingError && Array.isArray(rows)) {
        const topRows = rows.slice(0, 4) as Array<{ circle_id: unknown; circle_name: unknown; post_id: unknown; content: unknown; tag: unknown; anonymous: unknown; author_name: unknown; author_initials: unknown }>;
        const avatarUrls = await loadCommunityAuthorAvatars(topRows.map((row) => ({
          contribution_id: String(row.post_id), kind: 'post' as const, anonymous: row.anonymous === true,
        })));
        setTrendingCirclePosts(topRows.map((row) => {
          const postId = String(row.post_id);
          const anonymous = row.anonymous === true;
          return {
            circle_id: String(row.circle_id), circle_name: String(row.circle_name), post_id: postId,
            content: String(row.content), tag: String(row.tag), anonymous,
            author_name: anonymous ? 'Anonymous' : String(row.author_name ?? 'Member'),
            author_initials: anonymous ? 'A' : String(row.author_initials ?? '?').slice(0, 2).toUpperCase(),
            avatar_url: anonymous ? null : avatarUrls.get(postId) ?? null,
          };
        }));
      } else setTrendingCircleError('We could not load trending Circle posts. Please try again.');
    } catch {
      setTrendingCircleError('We could not load trending Circle posts. Please try again.');
    } finally { setTrendingCircleLoading(false); }
  }, [isOffline]);

  const onRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await Promise.all([refresh(), loadCircles(), feed.refresh(), loadLiveSessions(), loadTrending(), loadTrendingCirclePosts()]);
    } catch {
      // Section loaders keep their own retryable errors; one failure must not hide the others.
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [feed.refresh, loadCircles, loadLiveSessions, loadTrending, loadTrendingCirclePosts, refresh]);
  useEffect(() => {
    if (isOffline || !user?.id) return;
    const channel = supabase.channel(`community-circle-memberships-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_circles', filter: `user_id=eq.${user.id}` }, () => {
        feed.clearCirclePosts();
        setTrendingCirclePosts([]);
        void Promise.all([loadCircles(true), loadTrendingCirclePosts()]);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [feed.clearCirclePosts, isOffline, loadCircles, loadTrendingCirclePosts, user?.id]);

  useEffect(() => { void loadTrending(); }, [loadTrending]);
  useFocusEffect(useCallback(() => {
    void Promise.all([feed.refresh(true), loadTrendingCirclePosts()]);
    return undefined;
  }, [feed.refresh, loadTrendingCirclePosts]));

  useEffect(() => { void loadCircles(); }, [loadCircles]);
  useEffect(() => { void loadLiveSessions(); }, [loadLiveSessions]);

  return (
    <PillarScreen
      loading={loading && !data && !isOffline && feed.posts.length === 0}
      skeleton={<PillarSkeleton cards={3} />}
      refreshing={refreshing}
      onRefresh={hasUser ? onRefresh : undefined}
      error={data || isOffline || feed.posts.length > 0 ? null : error}
      errorMessage="We couldn't bring in your community feed and dad connections. Try again in a moment."
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <ScreenErrorNotice message={circleError} />
      <ScreenErrorNotice message={feed.error} />
      <ScreenErrorNotice message={liveSessionsError} />
      <ScreenErrorNotice message={trendingError} />
      <ScreenErrorNotice message={trendingCircleError} />
      {circleError ? <RetryRow onPress={() => void loadCircles()} /> : null}
      {liveSessionsError ? <RetryRow onPress={() => void loadLiveSessions()} /> : null}
      {trendingError ? <RetryRow onPress={() => void loadTrending()} /> : null}
      {trendingCircleError ? <RetryRow onPress={() => void loadTrendingCirclePosts()} /> : null}
      {feed.error ? <RetryRow onPress={() => void feed.refresh()} /> : null}
      <FadeInView>
        <Text className="font-heading-bold text-lime uppercase tracking-label text-[11px]">
          Dad Health Community
        </Text>
        <Text className="mt-[10px] font-heading uppercase text-white text-[54px] leading-[54px]">
          Community Feed
        </Text>
        {hasUser ? (
          <View className="mt-xs flex-row items-center gap-sm">
            <View className="h-[7px] w-[7px] rounded-full bg-lime" />
            <Text className="font-heading-bold text-lime text-[11px] uppercase">
              {onlinePresence.status === 'available'
                ? `${onlinePresence.count} ${onlinePresence.count === 1 ? 'member' : 'members'}`
                : onlinePresence.status === 'loading' ? 'Members online' : 'Online count unavailable'}
            </Text>
          </View>
        ) : null}
      </FadeInView>

      <FadeInView delay={90}>
        <SectionHeader title="Your Dad Circles" className="mb-xs" />
        <Text className="mb-md font-body text-muted-text text-[14px] leading-[20px]">
          Your Dad Circles — find dads going through the same chapter as you
        </Text>
        {circlesLoading ? (
          <View className="gap-sm">{[0, 1, 2, 3].map((item) => <View key={item} className="h-[112px] rounded-card bg-white/5" />)}</View>
        ) : circleError ? null : communityCircles.length === 0 ? (
          <Text className="font-body text-muted-text text-[14px]">No circles yet</Text>
        ) : (
          <View className="gap-sm">
            {communityCircles.map((circle) => (
              <CircleCard
                key={circle.id}
                id={circle.id}
                leading={
                  <Feather
                    name={dashboardIcon(circle.icon ?? 'community')}
                    size={18}
                    color={colors.dark}
                  />
                }
                name={circle.name}
                description={circle.description}
                membersCount={circle.members_count}
                joined={circle.joined}
                visibility={circle.visibility}
                onOpen={(circleId) => navigation.navigate('CommunityFeed', { circleId })}
              />
            ))}
          </View>
        )}
      </FadeInView>

      <FadeInView delay={105}>
        <Pressable onPress={() => navigation.navigate('CommunityFeed')} accessibilityRole="button" accessibilityLabel="Open Community Conversations" className="min-h-[96px] flex-row items-center gap-md rounded-card border border-border bg-card p-md active:opacity-75">
          <View className="h-[44px] w-[44px] shrink-0 rounded-full bg-lime items-center justify-center"><Feather name="message-circle" size={20} color={colors.dark} /></View>
          <View className="flex-1"><Text className="font-heading-bold text-white text-[13px] uppercase">Community Conversations</Text><Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">Read and share with the whole community</Text></View>
          <Feather name="chevron-right" size={18} color={colors.lime} />
        </Pressable>
      </FadeInView>

      <FadeInView delay={120}>
        <SectionHeader title="Live sessions" className="mb-md" />
        {liveSessionsLoading ? <View className="gap-sm"><View className="h-[54px] border-y border-border bg-white/[0.02]" /><View className="h-[54px] border-b border-border bg-white/[0.02]" /></View> : liveSessionsError ? null : liveSessions.length === 0 ? <Text className="font-body text-muted-text text-[14px]">No live sessions are scheduled yet.</Text> : <View>{liveSessions.map((session) => <View key={session.id} className="border-b border-border py-md gap-xs"><Text className="font-heading-bold text-lime text-[14px] uppercase">{session.title}</Text><Text className="font-body text-tertiary-text text-[12px] leading-[18px]">{session.host_name ? `Host: ${session.host_name}` : 'Host TBD'}{session.starts_at ? ` · ${new Date(session.starts_at).toLocaleString()}` : ''}</Text>{session.summary ? <Text className="font-body text-tertiary-text text-[14px] leading-[19px] mt-xs">{session.summary}</Text> : null}</View>)}</View>}
      </FadeInView>

      <FadeInView delay={140}>
        <SectionHeader title="Trending in Dad Circles" className="mb-md" />
        {trendingCircleLoading ? <View className="gap-sm"><View className="h-[72px] border-b border-border bg-white/[0.02]" /><View className="h-[72px] border-b border-border bg-white/[0.02]" /></View> : trendingCircleError ? null : trendingCirclePosts.length === 0 ? <Text className="font-body text-muted-text text-[14px]">No trending Circle posts yet.</Text> : <View>{trendingCirclePosts.map((post) => (
          <Pressable key={post.post_id} onPress={() => navigation.navigate('CommunityPostThread', { postId: post.post_id })} accessibilityRole="button" accessibilityLabel={`Open trending post from ${post.circle_name}`} className="border-b border-border py-md gap-sm active:opacity-75">
            <View className="flex-row items-center justify-between gap-md">
              <Text numberOfLines={1} className="flex-1 font-heading-bold text-lime text-[12px] tracking-label uppercase">{post.circle_name}</Text>
              <View className="bg-lime px-sm py-xs">
                <Text className="font-heading-bold text-dark text-[11px] uppercase">{communityTagLabel(post.tag)}</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-sm">
              <CommunityAuthorAvatar avatarUrl={post.avatar_url} initials={post.author_initials} anonymous={post.anonymous} size="comment" />
              <Text className="font-heading-bold text-white text-[11px]">{post.author_name}</Text>
            </View>
            <Text numberOfLines={2} className="font-body text-white text-[14px] leading-[21px]">{post.content}</Text>
            <View className="flex-row items-center justify-between">
              {(() => {
                const engagement = feed.posts.find((feedPost) => feedPost.id === post.post_id);
                return engagement ? (
                  <View className="flex-row items-center gap-md">
                    <View className="flex-row items-center gap-xs"><Feather name="heart" size={13} color={colors.tertiaryText} /><Text className="font-body text-tertiary-text text-[12px]">{engagement.likes_count}</Text></View>
                    <View className="flex-row items-center gap-xs"><Feather name="message-circle" size={13} color={colors.tertiaryText} /><Text className="font-body text-tertiary-text text-[12px]">{engagement.replies_count}</Text></View>
                  </View>
                ) : <View />;
              })()}
              <Feather name="chevron-right" size={16} color={colors.lime} />
            </View>
          </Pressable>
        ))}</View>}
      </FadeInView>

      <FadeInView delay={160}>
        <SectionHeader title="Trending topics" className="mb-md" />
        {trendingLoading ? <View className="gap-sm"><View className="h-[42px] border-y border-border bg-white/[0.02]" /><View className="h-[42px] border-b border-border bg-white/[0.02]" /></View> : trendingError ? null : trendingTags.length === 0 ? <Text className="font-body text-muted-text text-[14px]">No trending tags yet.</Text> : <View>{trendingTags.map((trend) => <View key={trend.tag} className="min-h-[42px] flex-row items-center justify-between border-b border-border"><Text className="font-heading-bold text-lime text-[14px]">{trend.tag}</Text><Text className="font-heading-bold text-tertiary-text text-[12px]">{trend.count}</Text></View>)}</View>}
      </FadeInView>
    </PillarScreen>
  );
}

function RetryRow({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" className="min-h-[44px] justify-center"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable>;
}
