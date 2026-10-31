import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import ScreenErrorNotice from '../../components/ScreenErrorNotice';
import InteractiveFeedPost from '../../components/community/InteractiveFeedPost';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { useCommunityFeed } from '../../hooks/useCommunityFeed';
import { trackEvent } from '../../lib/analytics';
import { dashboardIcon } from '../../lib/dashboardIcons';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';
import { supabase } from '../../lib/supabase';

type CircleDetails = {
  id: string;
  icon: string | null;
  name: string;
  description: string | null;
  members_count: number | null;
  visibility: 'public' | 'private';
};

export default function CommunityFeedScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'CommunityFeed'>>();
  const { user } = useAuth();
  const { showOfflineAction } = useNetworkStatus();
  const circleId = route.params?.circleId;
  const feed = useCommunityFeed(user?.id, circleId);
  const [circle, setCircle] = useState<CircleDetails | null>(null);
  const [circleJoined, setCircleJoined] = useState<boolean | null>(null);
  const [circleLoading, setCircleLoading] = useState(Boolean(circleId));
  const [circleError, setCircleError] = useState<string | null>(null);
  const [circleBusy, setCircleBusy] = useState(false);
  const circleBusyRef = useRef(false);
  const initialFocusRef = useRef(true);
  const [activeCircleTab, setActiveCircleTab] = useState<'discussion' | 'about'>('discussion');
  const [message, setMessage] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const circleLoadSequence = useRef(0);
  const membershipContext = useRef(`${circleId ?? ''}:${user?.id ?? ''}`);
  const [refreshing, setRefreshing] = useState(false);
  const [leaveConfirmationOpen, setLeaveConfirmationOpen] = useState(false);

  const loadCircle = useCallback(async (silent = false) => {
    const requestSequence = ++circleLoadSequence.current;
    const nextMembershipContext = `${circleId ?? ''}:${user?.id ?? ''}`;
    if (membershipContext.current !== nextMembershipContext) {
      membershipContext.current = nextMembershipContext;
      setCircleJoined(null);
    }
    if (!circleId) { setCircle(null); setCircleJoined(null); setCircleLoading(false); return; }
    if (!silent) setCircleLoading(true);
    setCircleError(null);
    if (feed.isOffline) {
      setCircleError('You’re offline. Circle details and posts need an internet connection.');
      if (!silent) setCircleLoading(false);
      return;
    }
    try {
      const [circleResult, membershipResult] = await Promise.all([
        supabase.from('circles').select('id,icon,name,description,members_count,visibility').eq('id', circleId).maybeSingle(),
        user?.id ? supabase.from('user_circles').select('circle_id').eq('user_id', user.id).eq('circle_id', circleId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (requestSequence !== circleLoadSequence.current) return;
      if (circleResult.error || membershipResult.error) {
        setCircleError('We could not load this Circle. Please try again.');
      } else if (!circleResult.data) {
        setCircle(null);
        setCircleJoined(false);
        setCircleError('This Circle is unavailable.');
      } else {
        const row = circleResult.data;
        setCircle({
          id: String(row.id),
          icon: typeof row.icon === 'string' ? row.icon : null,
          name: String(row.name),
          description: typeof row.description === 'string' ? row.description : null,
          members_count: typeof row.members_count === 'number' ? row.members_count : null,
          visibility: row.visibility === 'private' ? 'private' : 'public',
        });
        setCircleJoined(Boolean(user?.id && membershipResult.data));
      }
    } catch {
      if (requestSequence === circleLoadSequence.current) {
        setCircleError('We could not load this Circle. Please try again.');
      }
    } finally {
      if (!silent && requestSequence === circleLoadSequence.current) setCircleLoading(false);
    }
  }, [circleId, feed.isOffline, user?.id]);

  useEffect(() => {
    void loadCircle();
    return () => { circleLoadSequence.current += 1; };
  }, [loadCircle]);

  useFocusEffect(useCallback(() => {
    if (initialFocusRef.current) {
      initialFocusRef.current = false;
      return undefined;
    }
    void Promise.all([feed.refresh(true), loadCircle(true)]);
    return undefined;
  }, [feed.refresh, loadCircle]));

  const onRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await Promise.all([feed.refresh(), loadCircle()]);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [feed.refresh, loadCircle]);

  const changeCircleMembership = async () => {
    if (!user?.id) { navigation.navigate('Login'); return; }
    if (!circleId || circleJoined === null || circleBusyRef.current) return;
    if (feed.isOffline) { showOfflineAction('community_update'); return; }
    circleBusyRef.current = true;
    setCircleBusy(true);
    setCircleError(null);
    try {
      const result = circleJoined
        ? await supabase.from('user_circles').delete().eq('user_id', user.id).eq('circle_id', circleId)
        : await supabase.from('user_circles').insert({ user_id: user.id, circle_id: circleId });
      if (result.error) {
        setCircleError(`We could not ${circleJoined ? 'leave' : 'join'} this Circle. Please try again.`);
      } else {
        if (!circleJoined) trackEvent('circle_joined', { circle_id: circleId }, user.id);
        setCircleJoined(!circleJoined);
        setActiveCircleTab('discussion');
        await loadCircle(true);
      }
    } catch {
      setCircleError(`We could not ${circleJoined ? 'leave' : 'join'} this Circle. Please try again.`);
    } finally {
      circleBusyRef.current = false;
      setCircleBusy(false);
    }
  };

  const toggleCircleMembership = () => {
    if (circleJoined !== true) {
      void changeCircleMembership();
      return;
    }
    setLeaveConfirmationOpen(true);
  };

  const openComposer = () => {
    if (feed.isOffline) { showOfflineAction('community_post'); return; }
    navigation.navigate('CreateCommunityPost', circleId ? { circleId } : undefined);
  };

  const openThread = (postId: string) => {
    if (feed.isOffline) { showOfflineAction('community_thread'); return; }
    navigation.navigate('CommunityPostThread', { postId });
  };

  const runUpdate = (operation: () => Promise<string | null>) => {
    if (feed.isOffline) { showOfflineAction('community_update'); return; }
    setMessage(null);
    void operation().then((result) => setMessage(result)).catch(() => setMessage('We could not complete that Community action. Please try again.'));
  };

  const onFeedScroll = (event: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    if (circleId && (circleJoined !== true || activeCircleTab !== 'discussion')) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 480) void feed.loadMore();
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onFeedScroll}
        scrollEventThrottle={300}
        contentContainerClassName="flex-grow px-lg pt-lg pb-xl"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lime} />}
      >
        {circleId ? <View className="min-h-[44px] flex-row items-center justify-between" accessibilityRole="header">
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back to previous screen" className="min-h-[44px] flex-row items-center gap-xs"><Feather name="chevron-left" size={20} color={colors.lime} /><Text className="font-heading-bold text-lime text-[11px] uppercase">Post Thread</Text></Pressable>
          {circleJoined === true ? <Pressable onPress={toggleCircleMembership} disabled={circleBusy} accessibilityRole="button" accessibilityState={{ selected: true, disabled: circleBusy }} accessibilityLabel={`Leave ${circle?.name ?? 'Circle'}`} className="min-h-[44px] rounded-full border border-lime/50 px-md items-center justify-center"><Text className="font-heading-bold text-[12px] uppercase text-lime">{circleBusy ? 'Saving' : 'Joined ✓'}</Text></Pressable> : <View className="w-[88px]" />}
        </View> : <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityLabel="Go back" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />}
        {circleId ? circleJoined === true || circleLoading ? (
          <View className="mt-xl gap-md">
            {circleLoading ? <View className="h-[100px] bg-white/5" /> : circle && circleJoined === true ? <View className="gap-sm">
              <View className="flex-row items-center gap-sm">
                <View className="h-[42px] w-[42px] rounded-full bg-lime items-center justify-center">
                  <Feather name={dashboardIcon(circle.icon ?? 'community')} size={20} color={colors.dark} />
                </View>
                <View className="flex-1">
                  <Text
  className="font-heading-bold text-lime text-[11px] tracking-[1.5px] uppercase"
  numberOfLines={1}
>
  {circle.name}
</Text>
                  {circle.visibility === 'private' ? <Text className="font-heading-bold text-tertiary-text text-[11px] uppercase mt-xs">Private Circle</Text> : null}
                </View>
              </View>
              {circle.description ? <Text className="font-body text-muted-text text-[14px] leading-[20px]">{circle.description}</Text> : null}
              <Text className="font-heading-bold text-tertiary-text text-[12px] uppercase mt-sm">{circle.members_count ?? 0} {circle.members_count === 1 ? 'dad' : 'dads'}</Text>
              {circleJoined === true ? <Pressable onPress={openComposer} accessibilityRole="button" className="mt-md min-h-[48px] rounded-button bg-lime items-center justify-center active:opacity-80"><Text className="font-heading-bold text-dark text-[12px] uppercase">Create Post</Text></Pressable> : null}
            </View> : null}
          </View>
        ) : null : <View className="mt-xl"><ScreenHero eyebrow="Dad Health Community" headline="Community Conversations" /></View>}
        <ScreenErrorNotice message={circleError} />
        {!circleId || circleJoined === true ? <ScreenErrorNotice message={message ?? feed.error} /> : null}
        {!feed.loading && feed.error && (!circleId || circleJoined === true) ? <Pressable onPress={() => void Promise.all([feed.refresh(), circleId ? loadCircle() : Promise.resolve()])} accessibilityRole="button" className="min-h-[44px] justify-center"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable> : null}
        {!circleId ? <Pressable onPress={openComposer} accessibilityRole="button" className="min-h-[58px] flex-row items-center gap-md border-y border-border mt-xl px-sm active:opacity-75">
          <View className="h-[34px] w-[34px] rounded-full bg-lime items-center justify-center"><Feather name="edit-3" size={16} color={colors.dark} /></View>
          <Text className="flex-1 font-body text-muted-text text-[14px]">Start a Post</Text>
          <Feather name="chevron-right" size={18} color={colors.lime} />
        </Pressable> : null}
        {circleId && circle && circleJoined === true ? <View className="mt-xl flex-row border-b border-border">
          {(['discussion', 'about'] as const).map((tab) => <Pressable key={tab} onPress={() => setActiveCircleTab(tab)} accessibilityRole="tab" accessibilityState={{ selected: activeCircleTab === tab }} className={`flex-1 min-h-[48px] items-center justify-center border-b-2 ${activeCircleTab === tab ? 'border-lime' : 'border-transparent'}`}><Text className={`font-heading-bold text-[11px] uppercase ${activeCircleTab === tab ? 'text-lime' : 'text-tertiary-text'}`}>{tab}</Text></Pressable>)}
        </View> : null}
        {circleId && circleJoined === true && activeCircleTab === 'about' ? <View className="mt-lg gap-md">
          <Text className="font-heading-bold text-white text-[16px] uppercase">About this Circle</Text>
          {circle?.description ? <Text className="font-body text-muted-text text-[14px] leading-[22px]">{circle.description}</Text> : <Text className="font-body text-muted-text text-[14px]">No Circle description available.</Text>}
          <Text className="font-heading-bold text-tertiary-text text-[12px] uppercase">{circle?.members_count ?? 0} {circle?.members_count === 1 ? 'dad' : 'dads'}</Text>
        </View> : circleId && circleJoined !== true ? <View className="flex-1 items-center justify-center px-md">
          {circleJoined === null ? circleLoading ? <View className="h-[48px]" /> : <Pressable onPress={() => void loadCircle()} accessibilityRole="button" className="min-h-[48px] items-center justify-center"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable>
              : circle ? <View className="w-full items-center">
                <Text className="font-heading-bold text-white text-[17px] text-center">This circle is here when you need it.</Text>
                <Text className="font-body text-muted-text text-[14px] leading-[21px] text-center mt-sm">Join to share experiences, ask questions and hear from dads going through something similar.</Text>
                <Pressable onPress={user?.id ? () => void changeCircleMembership() : () => navigation.navigate('Login')} disabled={circleBusy} accessibilityRole="button" className="mt-lg min-h-[48px] px-lg items-center justify-center"><Text className="font-heading-bold text-lime text-[12px] uppercase">{circleBusy ? 'Joining' : 'Join Circle'}</Text></Pressable>
              </View> : null
          }
        </View> : <View className="mt-lg">
            {feed.loading || refreshing ? [0, 1, 2].map((item) => <View key={item} className="h-[170px] border-b border-border bg-white/[0.02]" />)
              : feed.isOffline && feed.posts.length === 0 ? <Text className="font-body text-muted-text text-[14px]">You’re offline. Circle posts need an internet connection.</Text>
                : feed.posts.length === 0 ? <Text className="font-body text-muted-text text-[14px]">No posts yet. Be the first to share.</Text>
                  : feed.posts.map((post) => <InteractiveFeedPost key={post.id} post={post} showCircleName={!circleId} liked={feed.likedIds.has(post.id)} saved={feed.savedIds.has(post.id)} owner={Boolean(user?.id && (post.user_id === user.id || feed.anonymousOwnedIds.has(post.id)))} busy={feed.busyId === post.id || feed.likeBusyIds.has(post.id)} onLike={() => runUpdate(() => feed.toggleLike(post.id))} onSave={() => runUpdate(() => feed.toggleSave(post.id))} onThread={() => openThread(post.id)} onDelete={() => runUpdate(() => feed.deletePost(post.id))} />)}
          {(!circleId || activeCircleTab === 'discussion') && (circleId ? circleJoined === true : true) && feed.hasMore ? <View className="min-h-[48px] items-center justify-center border-y border-border mt-md">
            {feed.loadingMore ? <ActivityIndicator color={colors.lime} size="small" /> : feed.paginationError ? <View className="flex-row items-center gap-md"><Text className="font-body text-muted-text text-[14px] leading-[20px]">{feed.paginationError}</Text><Pressable onPress={() => void feed.loadMore()} disabled={feed.isOffline} accessibilityRole="button"><Text className="font-heading-bold text-lime text-[12px] uppercase">Retry</Text></Pressable></View> : null}
          </View> : null}
        </View>}
      </ScrollView>
      <Modal visible={leaveConfirmationOpen} transparent animationType="fade" onRequestClose={() => setLeaveConfirmationOpen(false)}>
        <View className="flex-1 justify-center bg-black/75 px-lg">
          <View className="rounded-card border border-lime/25 bg-dark p-lg">
            <Text className="font-heading text-white text-[22px] uppercase">Leave this circle?</Text>
            <Text className="font-body text-muted-text text-[14px] leading-[21px] mt-sm">You can always come back. Leaving means you won't see this circle's conversations here until you join again.</Text>
            <View className="flex-row gap-sm mt-lg">
              <Pressable onPress={() => setLeaveConfirmationOpen(false)} accessibilityRole="button" className="min-h-[48px] flex-1 rounded-button border border-border items-center justify-center"><Text className="font-heading-bold text-white text-[12px] uppercase">Stay</Text></Pressable>
              <Pressable onPress={() => { setLeaveConfirmationOpen(false); void changeCircleMembership(); }} disabled={circleBusy} accessibilityRole="button" className="min-h-[48px] flex-1 rounded-button bg-lime items-center justify-center"><Text className="font-heading-bold text-dark text-[12px] uppercase">{circleBusy ? 'Leaving' : 'Leave Circle'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
