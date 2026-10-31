import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import MultilineTextInput from '../../components/MultilineTextInput';
import CommunityAuthorAvatar from '../../components/community/CommunityAuthorAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { trackEvent } from '../../lib/analytics';
import { communityTagLabel } from '../../lib/communityLabels';
import { loadCommunityAuthorAvatars } from '../../lib/communityAuthorAvatars';
import { deleteCommunityPost, toggleCommunityPostLike, toggleCommunityPostSave } from '../../lib/communityPostActions';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';
import { dashboardIcon } from '../../lib/dashboardIcons';

type Comment = { id: string; user_id: string; content: string; parent_id: string | null; created_at: string; anonymous: boolean; author: string; author_initials: string; avatar_url: string | null; likes_count: number; user_liked: boolean };
type PostDetails = { id: string; user_id: string | null; content: string; author_name: string; author_initials: string; avatar_url: string | null; anonymous: boolean; tag: string; circle_name: string | null; created_at: string; likes_count: number; replies_count: number };

export default function CommunityPostThreadScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'CommunityPostThread'>>();
  const { user } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const [post, setPost] = useState<PostDetails | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [owner, setOwner] = useState(false);
  const [postActionBusy, setPostActionBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [respectBusyId, setRespectBusyId] = useState<string | null>(null);
  const respectLocks = useRef(new Set<string>());
  const deleteCommentLocks = useRef(new Set<string>());
  const postActionLock = useRef(false);
  const pendingComment = useRef<{ id: string; signature: string; payload: { id: string; user_id: string; post_id: string; content: string; parent_id: string | null } } | null>(null);
  const [commentUncertain, setCommentUncertain] = useState(false);
  const [commentSafeToRetry, setCommentSafeToRetry] = useState(false);
  const commentSubmitInFlight = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (isOffline) { setLoading(false); setError(null); return; }
    if (!silent) setLoading(true);
    try {
    const [postResult, commentResult] = await Promise.all([
      supabase.from('posts').select('id,user_id,content,author_name,author_initials,anonymous,tag,circle_id,created_at').eq('id', route.params.postId).maybeSingle(),
      supabase.from('comments').select('id,user_id,content,parent_id,created_at,anonymous,author_name').eq('post_id', route.params.postId).order('created_at', { ascending: true }),
    ]);
    if (postResult.error || commentResult.error || !postResult.data) {
      if (!postResult.error && !postResult.data) setPost(null);
      setError('We could not load this conversation. Please try again.');
      setLoading(false);
      return;
    }
    const row = postResult.data;
    const [circleResult, likesResult, savedResult, anonymousOwnerResult] = await Promise.all([
      row.circle_id ? supabase.from('circles').select('name,icon').eq('id', String(row.circle_id)).maybeSingle() : Promise.resolve({ data: null, error: null }),
      supabase.from('likes').select('user_id').eq('post_id', route.params.postId),
      user?.id ? supabase.from('saved_posts').select('post_id').eq('post_id', route.params.postId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      user?.id ? supabase.from('anonymous_post_owners').select('post_id').eq('post_id', route.params.postId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (circleResult.error || likesResult.error || savedResult.error || anonymousOwnerResult.error) {
      setError('We could not load all Community activity. Please try again.');
      setLoading(false);
      return;
    }
    const rows = commentResult.data ?? [];
    const commentIds = rows.map((item) => String(item.id));
    const commentLikesResult = commentIds.length
      ? await supabase.from('comment_likes').select('comment_id,user_id').in('comment_id', commentIds)
      : { data: [], error: null };
    if (commentLikesResult.error) { setError('We could not load all Community activity. Please try again.'); setLoading(false); return; }
    const likeCounts = new Map<string, number>();
    const likedCommentIds = new Set<string>();
    (commentLikesResult.data ?? []).forEach((item: { comment_id: string; user_id: string }) => {
      const id = String(item.comment_id);
      likeCounts.set(id, (likeCounts.get(id) ?? 0) + 1);
      if (item.user_id === user?.id) likedCommentIds.add(id);
    });
    const userIds = [...new Set(rows.map((item) => String(item.user_id)))];
    const [profileResult, avatarUrls] = await Promise.all([
      userIds.length ? supabase.from('user_profile').select('user_id,display_name').in('user_id', userIds) : Promise.resolve({ data: [], error: null }),
      loadCommunityAuthorAvatars([
        { contribution_id: String(row.id), kind: 'post', anonymous: row.anonymous === true },
        ...rows.map((item) => ({ contribution_id: String(item.id), kind: 'comment' as const, anonymous: item.anonymous === true })),
      ]),
    ]);
    let activityWarning: string | null = profileResult.error ? 'We could not load all Community activity. Please try again.' : null;
    const names = new Map((profileResult.data ?? []).map((profile: { user_id: string; display_name: string | null }) => [String(profile.user_id), profile.display_name?.trim() || null]));
    if (names.size < userIds.length || [...names.values()].some((name) => !name)) {
      const authorResult = await supabase.rpc('get_comment_author_names', { p_user_ids: userIds });
      if (authorResult.error) activityWarning = 'We could not load all Community activity. Please try again.';
      (authorResult.data ?? []).forEach((profile: { user_id: string; display_name: string | null }) => {
        if (profile.display_name?.trim()) names.set(String(profile.user_id), profile.display_name.trim());
      });
    }
    setPost({
      id: String(row.id), user_id: row.user_id ? String(row.user_id) : null,
      content: String(row.content), author_name: row.anonymous ? 'Anonymous' : String(row.author_name ?? 'Member'),
      author_initials: row.anonymous ? 'A' : safeInitials(row.author_initials), anonymous: row.anonymous === true,
      avatar_url: row.anonymous === true ? null : avatarUrls.get(String(row.id)) ?? null,
      tag: String(row.tag ?? ''), circle_name: typeof circleResult.data?.name === 'string' ? circleResult.data.name : null,
      created_at: String(row.created_at), likes_count: likesResult.data?.length ?? 0, replies_count: rows.length,
    });
    setLiked(Boolean(user?.id && likesResult.data?.some((item: { user_id: string }) => item.user_id === user.id)));
    setSaved(Boolean(savedResult.data));
    setOwner(Boolean(user?.id && (row.user_id === user.id || anonymousOwnerResult.data)));
    setComments(rows.map((item) => {
      const id = String(item.id);
      const storedAuthor = String(item.author_name ?? '').trim();
      const resolvedAuthor = storedAuthor || names.get(String(item.user_id)) || (String(item.user_id) === user?.id ? 'You' : 'Dad');
      const anonymous = item.anonymous === true;
      return { id, user_id: String(item.user_id), content: String(item.content), parent_id: item.parent_id ? String(item.parent_id) : null, created_at: String(item.created_at), anonymous, author: anonymous ? 'Anonymous' : resolvedAuthor, author_initials: anonymous ? 'A' : safeInitials(resolvedAuthor), avatar_url: anonymous ? null : avatarUrls.get(id) ?? null, likes_count: likeCounts.get(id) ?? 0, user_liked: likedCommentIds.has(id) };
    }));
    setError(activityWarning);
    } catch {
      setError('We could not load this conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isOffline, route.params.postId, user?.id]);

  useEffect(() => {
    void load();
    if (isOffline) return;
    const channel = supabase.channel(`mobile-thread-${route.params.postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `id=eq.${route.params.postId}` }, () => void load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${route.params.postId}` }, () => void load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, () => void load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${route.params.postId}` }, () => void load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_posts', filter: `post_id=eq.${route.params.postId}` }, () => void load(true))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isOffline, load, route.params.postId]);

  const roots = useMemo(() => comments.filter((comment) => !comment.parent_id), [comments]);
  const replies = useMemo(() => { const map = new Map<string, Comment[]>(); comments.filter((comment) => comment.parent_id).forEach((comment) => { const list = map.get(comment.parent_id!) ?? []; list.push(comment); map.set(comment.parent_id!, list); }); return map; }, [comments]);

  const togglePostLike = async () => {
    if (!user?.id) { navigation.navigate('Login'); return; }
    if (isOffline || !post || postActionBusy || postActionLock.current) { if (isOffline) showOfflineAction('community_update'); return; }
    postActionLock.current = true;
    setPostActionBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setPost((current) => current ? { ...current, likes_count: Math.max(0, current.likes_count + (wasLiked ? -1 : 1)) } : current);
    try {
      const actionError = await toggleCommunityPostLike(user.id, post.id, wasLiked);
      if (actionError) { setLiked(wasLiked); await load(true); setError(actionError); }
    } catch {
      setLiked(wasLiked); setError('We could not update this like. Please try again.');
    } finally { postActionLock.current = false; setPostActionBusy(false); }
  };

  const togglePostSave = async () => {
    if (!user?.id) { navigation.navigate('Login'); return; }
    if (isOffline || !post || postActionBusy || postActionLock.current) { if (isOffline) showOfflineAction('community_update'); return; }
    postActionLock.current = true;
    setPostActionBusy(true);
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      const actionError = await toggleCommunityPostSave(user.id, post.id, wasSaved);
      if (actionError) { setSaved(wasSaved); setError(actionError); }
    } catch {
      setSaved(wasSaved); setError('We could not update this saved post. Please try again.');
    } finally { postActionLock.current = false; setPostActionBusy(false); }
  };

  const deletePost = () => {
    if (isOffline) { showOfflineAction('community_update'); return; }
    if (!user?.id || !post || !owner || postActionBusy || postActionLock.current) return;
    Alert.alert('Delete post?', 'This post and its replies will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (postActionLock.current) return;
        postActionLock.current = true;
        setPostActionBusy(true);
        void deleteCommunityPost(user.id, post.id).then((actionError) => {
          if (actionError) setError(actionError);
          else navigation.goBack();
        }).catch(() => setError('We could not delete this post. Please try again.')).finally(() => { postActionLock.current = false; setPostActionBusy(false); });
      } },
    ]);
  };

  const submit = async () => {
    const content = draft.trim(); if (!content || saving || commentSubmitInFlight.current) return; if (!user?.id) { navigation.navigate('Login'); return; }
    if (isOffline) { showOfflineAction('community_post'); return; }
    if (commentUncertain && !commentSafeToRetry) return;
    if (replyTo) { const parent = comments.find((comment) => comment.id === replyTo); if (!parent || parent.parent_id) { setComposerError('You can only reply to a main comment.'); return; } }
    const signature = JSON.stringify([content, replyTo, route.params.postId]);
    let pending = pendingComment.current;
    if (!pending || pending.signature !== signature) {
      const id = Crypto.randomUUID();
      pending = { id, signature, payload: { id, user_id: user.id, post_id: route.params.postId, content, parent_id: replyTo } };
      pendingComment.current = pending;
    }
    commentSubmitInFlight.current = true;
    setSaving(true); setComposerError(null);
    try {
      const { error: insertError } = await supabase.from('comments').upsert(pending.payload, { onConflict: 'id', ignoreDuplicates: true }).select('id');
      if (insertError) {
        if (isTransportFailure(insertError)) {
          setCommentUncertain(true);
          setCommentSafeToRetry(false);
          setComposerError('We could not confirm whether your reply was posted. Check its status before trying again.');
          return;
        }
        setComposerError('We could not post your reply. Please try again.');
        pendingComment.current = null;
        return;
      }
      trackEvent('comment_added', { post_id: route.params.postId, has_parent: Boolean(replyTo), content_length: content.length }, user.id);
      pendingComment.current = null;
      setCommentUncertain(false);
      setDraft(''); setReplyTo(null); await load(true);
    } catch {
      setCommentUncertain(true);
      setCommentSafeToRetry(false);
      setComposerError('We could not confirm whether your reply was posted. Check its status before trying again.');
    } finally {
      commentSubmitInFlight.current = false;
      setSaving(false);
    }
  };

  const checkCommentStatus = async () => {
    const pending = pendingComment.current;
    if (!pending || !user?.id || commentSubmitInFlight.current || isOffline) return;
    commentSubmitInFlight.current = true;
    setSaving(true);
    try {
      const { data, error: statusError } = await supabase.from('comments').select('id').eq('id', pending.id).eq('user_id', user.id).maybeSingle();
      if (statusError) { setComposerError('We could not check your reply status. Please try again.'); return; }
      if (data) {
        pendingComment.current = null;
        setCommentUncertain(false);
        setDraft(''); setReplyTo(null); await load(true);
      } else {
        setCommentSafeToRetry(true);
        setComposerError('No reply was found. You can safely try again.');
      }
    } catch {
      setComposerError('We could not check your reply status. Please try again.');
    } finally {
      commentSubmitInFlight.current = false;
      setSaving(false);
    }
  };

  const remove = (comment: Comment) => {
    if (isOffline) { showOfflineAction('community_update'); return; }
    Alert.alert('Delete reply?', 'This reply will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void (async () => { if (deleteCommentLocks.current.has(comment.id)) return; deleteCommentLocks.current.add(comment.id); try { const { error: deleteError } = await supabase.from('comments').delete().eq('id', comment.id).eq('user_id', user?.id); if (deleteError) setError('We could not delete this reply. Please try again.'); else await load(true); } catch { setError('We could not delete this reply. Please try again.'); } finally { deleteCommentLocks.current.delete(comment.id); } })() }]);
  };

  const toggleRespect = async (comment: Comment) => {
    if (!user?.id) { navigation.navigate('Login'); return; }
    if (isOffline) { showOfflineAction('community_update'); return; }
    if (respectLocks.current.has(comment.id)) return;
    respectLocks.current.add(comment.id);
    setRespectBusyId(comment.id);
    try {
    const result = comment.user_liked
      ? await supabase.from('comment_likes').delete().eq('user_id', user.id).eq('comment_id', comment.id)
      : await supabase.from('comment_likes').upsert({ user_id: user.id, comment_id: comment.id }, { onConflict: 'user_id,comment_id', ignoreDuplicates: true });
    if (result.error) { setError('We could not update respect. Please try again.'); return; }
    await load(true);
    } catch {
      setError('We could not update respect. Please try again.');
    } finally { respectLocks.current.delete(comment.id); setRespectBusyId(null); }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerClassName="px-lg pt-lg pb-xl gap-xl">
        <View className="min-h-[44px] flex-row items-center justify-between">
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>
          <Text accessibilityRole="header" className="font-heading-bold text-white text-[13px] uppercase">Post</Text>
          {owner ? <Pressable onPress={deletePost} disabled={postActionBusy} accessibilityRole="button" accessibilityLabel="Post options" className="h-[44px] w-[44px] items-center justify-center"><Feather name="more-vertical" size={20} color={colors.text} /></Pressable> : <View className="h-[44px] w-[44px]" />}
        </View>
        <InlineFormError message={isOffline ? null : error} />
        {error && post ? <Pressable onPress={() => void load(true)} accessibilityRole="button" className="min-h-[40px] justify-center"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable> : null}
        {loading ? <View className="h-[240px] bg-white/5" /> : isOffline && !post ? <Text className="font-body text-muted-text text-[14px]">You’re offline. This post isn’t available on this device.</Text> : error && !post ? <View className="gap-md"><Pressable onPress={() => void load()} accessibilityRole="button" className="min-h-[44px] justify-center"><Text className="font-heading-bold text-lime uppercase">Try again</Text></Pressable></View> : post ? <>
          <View className="border-b border-border pb-md">
  {post.circle_name ? (
    <Text className="font-heading-bold text-lime text-[11px] tracking-[1.5px] uppercase mb-md">
      {post.circle_name}
    </Text>
  ) : null}

  <View className="flex-row items-center gap-sm">
    <CommunityAuthorAvatar avatarUrl={post.avatar_url} initials={post.author_initials} anonymous={post.anonymous} size="detail" />

    <View className="flex-1">
      <Text className="font-heading-bold text-white text-[14px]">
        {post.author_name}
      </Text>
      <Text className="font-body text-tertiary-text text-[12px] leading-[16px] mt-[2px]">
        {formatRelativeTime(post.created_at)}
      </Text>
    </View>

    {post.tag ? (
      <Text className="font-heading-bold text-dark bg-lime px-sm py-xs text-[11px] uppercase">
        {communityTagLabel(post.tag)}
      </Text>
    ) : null}
  </View>
            <Text className="font-body text-white text-[16px] leading-[24px] mt-md">{post.content}</Text>
            <View className="flex-row items-center gap-xl mt-md">
              <Pressable onPress={() => void togglePostLike()} disabled={postActionBusy || isOffline} accessibilityRole="button" accessibilityState={{ selected: liked, disabled: postActionBusy || isOffline }} accessibilityLabel={liked ? 'Unlike post' : 'Like post'} className="min-h-[44px] flex-row items-center gap-xs"><Feather name="heart" size={18} color={liked ? colors.lime : colors.tertiaryText} /><Text className={`font-heading-bold text-[12px] ${liked ? 'text-lime' : 'text-tertiary-text'}`}>{post.likes_count}</Text></Pressable>
              <View className="min-h-[44px] flex-row items-center gap-xs"><Feather name="message-circle" size={18} color={colors.tertiaryText} /><Text className="font-heading-bold text-tertiary-text text-[12px]">{post.replies_count}</Text></View>
              <Pressable onPress={() => void togglePostSave()} disabled={postActionBusy || isOffline} accessibilityRole="button" accessibilityState={{ selected: saved, disabled: postActionBusy || isOffline }} accessibilityLabel={saved ? 'Unsave post' : 'Save post'} className="min-h-[44px] min-w-[44px] flex-row items-center"><Feather name="bookmark" size={18} color={saved ? colors.lime : colors.tertiaryText} /></Pressable>
            </View>
          </View>
          <View className="gap-md"><View className="flex-row items-center gap-sm"><Text className="font-heading-bold text-white text-[17px]">Replies</Text><Text className="font-body text-tertiary-text text-[14px]">{post.replies_count}</Text></View>{roots.length === 0 ? <Text className="font-body text-muted-text">No replies yet.</Text> : roots.map((comment) => <View key={comment.id} className="border-b border-border pb-md"><CommentRow comment={comment} owner={comment.user_id === user?.id} busy={respectBusyId === comment.id} onRespect={() => void toggleRespect(comment)} onDelete={() => remove(comment)} onReply={() => { setReplyTo(comment.id); setDraft(''); setComposerError(null); }} />{(replies.get(comment.id) ?? []).map((reply) => <View key={reply.id} className="ml-xl mt-md border-l-2 border-l-lime/30 pl-md"><CommentRow comment={reply} owner={reply.user_id === user?.id} busy={respectBusyId === reply.id} onRespect={() => void toggleRespect(reply)} onDelete={() => remove(reply)} /></View>)}</View>)}</View>
          {replyTo ? <View className="flex-row items-center justify-between gap-md"><Text className="flex-1 font-body text-muted-text text-[14px] leading-[20px]">Replying to {comments.find((comment) => comment.id === replyTo)?.author}</Text><Pressable disabled={commentUncertain} onPress={() => { setReplyTo(null); setComposerError(null); }} className="min-h-[44px] min-w-[52px] items-center justify-center"><Text className="font-heading-bold text-lime text-[12px] uppercase">Cancel</Text></Pressable></View> : null}
          <MultilineTextInput value={draft} editable={!commentUncertain} onChangeText={(value) => { setDraft(value); setComposerError(null); }} placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'} placeholderTextColor={colors.tertiaryText} className="min-h-[90px] rounded-button border border-border bg-card p-md font-body text-white" />
          <InlineFormError message={isOffline ? null : composerError} />
          {commentUncertain && !commentSafeToRetry ? <LimeButton label="Check reply status" onPress={() => void checkCommentStatus()} loading={saving} disabled={isOffline} /> : null}
          <LimeButton label={commentSafeToRetry ? 'Try again' : replyTo ? 'Reply' : 'Post comment'} onPress={() => void submit()} loading={saving} disabled={!draft.trim() || isOffline || (commentUncertain && !commentSafeToRetry)} />
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CommentRow({ comment, owner, busy, onRespect, onDelete, onReply }: { comment: Comment; owner: boolean; busy: boolean; onRespect: () => void; onDelete: () => void; onReply?: () => void }) {
  return <View className="gap-sm"><View className="flex-row items-center gap-sm"><CommunityAuthorAvatar avatarUrl={comment.avatar_url} initials={comment.author_initials} anonymous={comment.anonymous} size="comment" /><View className="flex-1"><Text className="font-heading-bold text-white text-[12px]">{comment.author}</Text><Text className="font-body text-tertiary-text text-[12px] leading-[16px]">{formatRelativeTime(comment.created_at)}</Text></View>{owner ? <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete your reply" className="h-[40px] w-[40px] items-center justify-center"><Feather name="trash-2" size={14} color="#FCA5A5" /></Pressable> : null}</View><Text className="font-body text-tertiary-text text-[14px] leading-[20px]">{comment.content}</Text><View className="flex-row flex-wrap items-center gap-lg"><Pressable onPress={onRespect} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: comment.user_liked, disabled: busy }} className="min-h-[44px] flex-row items-center gap-xs"><Feather name="heart" size={16} color={comment.user_liked ? colors.lime : colors.tertiaryText} /><Text className={`font-heading-bold text-[12px] uppercase ${comment.user_liked ? 'text-lime' : busy ? 'text-white/65' : 'text-tertiary-text'}`}>{comment.likes_count} RESPECT</Text></Pressable>{onReply ? <Pressable onPress={onReply} accessibilityRole="button" className="min-h-[44px] flex-row items-center gap-xs"><Feather name="message-circle" size={16} color={colors.lime} /><Text className="font-heading-bold text-[12px] uppercase text-lime">REPLY</Text></Pressable> : null}</View></View>;
}

function safeInitials(value: unknown) { const text = typeof value === 'string' ? value.trim() : ''; return text && !/^\?+$/.test(text) ? text.slice(0, 2).toUpperCase() : '?'; }
function formatRelativeTime(value: string) { const time = new Date(value).getTime(); if (!Number.isFinite(time)) return ''; const minutes = Math.max(1, Math.floor((Date.now() - time) / 60000)); if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return `${days}d ago`; }
function isTransportFailure(error: { code?: string; message?: string }) { const message = (error.message ?? '').toLowerCase(); return ['FETCH_ERROR', 'NETWORK_ERROR', 'TIMEOUT'].includes(error.code ?? '') || ['network request failed', 'failed to fetch', 'fetch failed', 'timed out', 'timeout', 'connection reset', 'aborted'].some((part) => message.includes(part)); }
