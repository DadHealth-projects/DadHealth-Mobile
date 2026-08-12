import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import InteractiveFeedPost from '../../components/community/InteractiveFeedPost';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useCommunityFeed } from '../../hooks/useCommunityFeed';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

export default function CommunityFeedScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const feed = useCommunityFeed(user?.id);
  const [message, setMessage] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { void feed.refresh(true); }, [feed.refresh]));

  return <SafeAreaView edges={['top']} className="flex-1 bg-dark"><ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-xl"><AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityLabel="Close recent posts" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>} /><View className="mt-xl"><ScreenHero eyebrow="Dad Health Community" headline="Recent Posts" /></View><Pressable onPress={() => navigation.navigate('CreateCommunityPost')} accessibilityRole="button" className="min-h-[58px] flex-row items-center gap-md border-y border-border mt-xl px-sm active:opacity-75"><View className="h-[34px] w-[34px] rounded-full bg-lime/10 items-center justify-center"><Feather name="edit-3" size={16} color={colors.lime} /></View><Text className="flex-1 font-body text-muted-text text-[14px]">Share something with the community...</Text><Feather name="chevron-right" size={18} color={colors.lime} /></Pressable>{message ? <Text accessibilityRole="alert" className="font-body text-red-300 text-[12px] mt-md">{message}</Text> : null}<View className="mt-lg">{feed.loading ? [0,1,2].map((item) => <View key={item} className="h-[170px] border-b border-border bg-white/[0.02]" />) : feed.error ? <View className="gap-md"><Text className="font-body text-red-300">{feed.error}</Text><Pressable onPress={() => void feed.refresh()}><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable></View> : feed.posts.length === 0 ? <Text className="font-body text-muted-text text-[14px]">No posts yet. Be the first to share.</Text> : feed.posts.map((post) => <InteractiveFeedPost key={post.id} post={post} liked={feed.likedIds.has(post.id)} saved={feed.savedIds.has(post.id)} owner={Boolean(user?.id && (post.user_id === user.id || feed.anonymousOwnedIds.has(post.id)))} busy={feed.busyId === post.id} onLike={() => void feed.toggleLike(post.id).then(setMessage)} onSave={() => void feed.toggleSave(post.id).then(setMessage)} onThread={() => navigation.navigate('CommunityPostThread', { postId: post.id })} onDelete={() => void feed.deletePost(post.id).then(setMessage)} />)}</View></ScrollView></SafeAreaView>;
}
