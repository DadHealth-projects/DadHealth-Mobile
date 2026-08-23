import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import GlobalErrorToastReporter from '../../components/GlobalErrorToastReporter';
import InteractiveFeedPost from '../../components/community/InteractiveFeedPost';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { useCommunityFeed } from '../../hooks/useCommunityFeed';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

export default function CommunityFeedScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { showOfflineAction } = useNetworkStatus();
  const feed = useCommunityFeed(user?.id);
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { void feed.refresh(true); }, [feed.refresh]));

  const openComposer = () => {
    if (feed.isOffline) { showOfflineAction('community_post'); return; }
    navigation.navigate('CreateCommunityPost');
  };

  const openThread = (postId: string) => {
    if (feed.isOffline) { showOfflineAction('community_thread'); return; }
    navigation.navigate('CommunityPostThread', { postId });
  };

  const runUpdate = (operation: () => Promise<string | null>) => {
    if (feed.isOffline) { showOfflineAction('community_update'); return; }
    void operation().then(setMessage);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityLabel="Close recent posts" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
        <View className="mt-xl"><ScreenHero eyebrow="Dad Health Community" headline="Recent Posts" /></View>
        <GlobalErrorToastReporter message={message ?? (feed.posts.length === 0 ? feed.error : null)} />
        <Pressable onPress={openComposer} accessibilityRole="button" className="min-h-[58px] flex-row items-center gap-md border-y border-border mt-xl px-sm active:opacity-75">
          <View className="h-[34px] w-[34px] rounded-full bg-lime/10 items-center justify-center"><Feather name="edit-3" size={16} color={colors.lime} /></View>
          <Text className="flex-1 font-body text-muted-text text-[14px]">Share something with the community...</Text>
          <Feather name="chevron-right" size={18} color={colors.lime} />
        </Pressable>
        <View className="mt-lg">
          {feed.loading ? [0, 1, 2].map((item) => <View key={item} className="h-[170px] border-b border-border bg-white/[0.02]" />)
            : feed.posts.length === 0 ? <Text className="font-body text-muted-text text-[14px]">No posts yet. Be the first to share.</Text>
              : feed.posts.map((post) => <InteractiveFeedPost key={post.id} post={post} liked={feed.likedIds.has(post.id)} saved={feed.savedIds.has(post.id)} owner={Boolean(user?.id && (post.user_id === user.id || feed.anonymousOwnedIds.has(post.id)))} busy={feed.busyId === post.id} onLike={() => runUpdate(() => feed.toggleLike(post.id))} onSave={() => runUpdate(() => feed.toggleSave(post.id))} onThread={() => openThread(post.id)} onDelete={() => runUpdate(() => feed.deletePost(post.id))} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
