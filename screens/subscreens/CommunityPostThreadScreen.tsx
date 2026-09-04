import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import GlobalErrorToastReporter from '../../components/GlobalErrorToastReporter';
import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Comment = { id: string; user_id: string; content: string; parent_id: string | null; created_at: string; anonymous: boolean; author: string; author_name: string | null; likes_count: number; user_liked: boolean };

export default function CommunityPostThreadScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'CommunityPostThread'>>();
  const { user } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const [post, setPost] = useState<{ content: string; author_name: string; anonymous: boolean; tag: string } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [respectBusyId, setRespectBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isOffline) { setLoading(false); setError(null); return; }
    setLoading(true);
    const [postResult, commentResult] = await Promise.all([
      supabase.from('posts').select('content,author_name,anonymous,tag').eq('id', route.params.postId).maybeSingle(),
      supabase.from('comments').select('id,user_id,content,parent_id,created_at,anonymous,author_name').eq('post_id', route.params.postId).order('created_at', { ascending: true }),
    ]);
    if (postResult.error || commentResult.error || !postResult.data) { setError('We could not load this conversation. Please try again.'); setLoading(false); return; }
    const rows = commentResult.data ?? [];
    const commentIds = rows.map((row) => String(row.id));
    const commentLikesResult = commentIds.length
      ? await supabase.from('comment_likes').select('comment_id,user_id').in('comment_id', commentIds)
      : { data: [], error: null };
    if (commentLikesResult.error) { setError('We could not load all Community activity. Please try again.'); setLoading(false); return; }
    const likeCounts = new Map<string, number>();
    const likedCommentIds = new Set<string>();
    (commentLikesResult.data ?? []).forEach((like: { comment_id: string; user_id: string }) => {
      const commentId = String(like.comment_id);
      likeCounts.set(commentId, (likeCounts.get(commentId) ?? 0) + 1);
      if (like.user_id === user?.id) likedCommentIds.add(commentId);
    });
    const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
    const profileResult = userIds.length ? await supabase.from('user_profile').select('user_id,display_name').in('user_id', userIds) : { data: [], error: null };
    const names = new Map((profileResult.data ?? []).map((profile: { user_id: string; display_name: string | null }) => [String(profile.user_id), profile.display_name?.trim() || null]));
    if (names.size < userIds.length || [...names.values()].some((name) => !name)) {
      const authorResult = await supabase.rpc('get_comment_author_names', { p_user_ids: userIds });
      (authorResult.data ?? []).forEach((profile: { user_id: string; display_name: string | null }) => {
        if (profile.display_name?.trim()) names.set(String(profile.user_id), profile.display_name.trim());
      });
    }
    setPost({ content: String(postResult.data.content), author_name: postResult.data.anonymous ? 'Anonymous' : String(postResult.data.author_name ?? 'Member'), anonymous: postResult.data.anonymous === true, tag: String(postResult.data.tag ?? '') });
    setComments(rows.map((row) => {
      const commentId = String(row.id);
      const storedAuthor = String(row.author_name ?? '').trim();
      const resolvedAuthor = storedAuthor || names.get(String(row.user_id)) || (String(row.user_id) === user?.id ? 'You' : 'Dad');
      return { id: commentId, user_id: String(row.user_id), content: String(row.content), parent_id: row.parent_id ? String(row.parent_id) : null, created_at: String(row.created_at), anonymous: row.anonymous === true, author: row.anonymous ? 'Anonymous' : resolvedAuthor, author_name: row.author_name ? String(row.author_name) : null, likes_count: likeCounts.get(commentId) ?? 0, user_liked: likedCommentIds.has(commentId) };
    }));
    setError(null); setLoading(false);
  }, [isOffline, route.params.postId, user?.id]);

  useEffect(() => {
    void load();
    if (isOffline) return;
    const channel = supabase.channel(`mobile-thread-${route.params.postId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${route.params.postId}` }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isOffline, load, route.params.postId]);

  const roots = useMemo(() => comments.filter((comment) => !comment.parent_id), [comments]);
  const replies = useMemo(() => { const map = new Map<string, Comment[]>(); comments.filter((comment) => comment.parent_id).forEach((comment) => { const list = map.get(comment.parent_id!) ?? []; list.push(comment); map.set(comment.parent_id!, list); }); return map; }, [comments]);
  const submit = async () => {
    const content = draft.trim(); if (!content) return; if (!user?.id) { navigation.navigate('Login'); return; }
    if (isOffline) { showOfflineAction('community_post'); return; }
    setSaving(true); setComposerError(null);
    if (replyTo) { const parent = comments.find((comment) => comment.id === replyTo); if (!parent || parent.parent_id) { setComposerError('You can only reply to a main comment.'); setSaving(false); return; } }
    const { error: insertError } = await supabase.from('comments').insert({ user_id: user.id, post_id: route.params.postId, content, parent_id: replyTo });
    if (insertError) setComposerError('We could not post your reply. Please try again.');
    else { trackEvent('comment_added', { post_id: route.params.postId, has_parent: Boolean(replyTo), content_length: content.length }, user.id); setDraft(''); setReplyTo(null); await load(); }
    setSaving(false);
  };
  const remove = (comment: Comment) => {
    if (isOffline) { showOfflineAction('community_update'); return; }
    Alert.alert('Delete reply?', 'This reply will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void supabase.from('comments').delete().eq('id', comment.id).eq('user_id', user?.id).then(({ error: deleteError }) => { if (deleteError) setError('We could not delete this reply.'); else void load(); }) }]);
  };
  const toggleRespect = async (comment: Comment) => {
    if (!user?.id) { navigation.navigate('Login'); return; }
    if (isOffline) { showOfflineAction('community_update'); return; }
    setRespectBusyId(comment.id);
    const result = comment.user_liked
      ? await supabase.from('comment_likes').delete().eq('user_id', user.id).eq('comment_id', comment.id)
      : await supabase.from('comment_likes').upsert({ user_id: user.id, comment_id: comment.id }, { onConflict: 'user_id,comment_id', ignoreDuplicates: true });
    setRespectBusyId(null);
    if (result.error) { setError('We could not update respect. Please try again.'); return; }
    await load();
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerClassName="px-lg pt-lg pb-xl gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center" accessibilityLabel="Close post thread"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
        <GlobalErrorToastReporter message={error} />
        {loading ? <View className="h-[240px] bg-white/5" /> : post ? <>
          <View className="border-b border-border pb-xl"><View className="flex-row items-center gap-sm"><View className="h-[36px] w-[36px] rounded-full border border-lime/40 bg-lime/10 items-center justify-center"><Text className="font-heading-bold text-lime text-[14px]">{post.anonymous ? 'A' : post.author_name.charAt(0).toUpperCase()}</Text></View><Text className="font-heading-bold text-white text-[14px]">{post.author_name}</Text></View><Text className="font-body text-white text-[18px] leading-[27px] mt-md">{post.content}</Text></View>
          <View className="gap-md"><Text className="font-heading-bold text-lime text-[11px] uppercase">Replies</Text>{roots.length === 0 ? <Text className="font-body text-muted-text">No replies yet.</Text> : roots.map((comment) => <View key={comment.id} className="border-b border-border pb-md"><CommentRow comment={comment} owner={comment.user_id === user?.id} busy={respectBusyId === comment.id} onRespect={() => void toggleRespect(comment)} onDelete={() => remove(comment)} onReply={() => { setReplyTo(comment.id); setDraft(''); setComposerError(null); }} />{(replies.get(comment.id) ?? []).map((reply) => <View key={reply.id} className="ml-xl mt-md border-l-2 border-l-lime/30 pl-md"><CommentRow comment={reply} owner={reply.user_id === user?.id} busy={respectBusyId === reply.id} onRespect={() => void toggleRespect(reply)} onDelete={() => remove(reply)} /></View>)}</View>)}</View>
          {replyTo ? <View className="flex-row items-center justify-between"><Text className="font-body text-muted-text text-[12px]">Replying to {comments.find((comment) => comment.id === replyTo)?.author}</Text><Pressable onPress={() => { setReplyTo(null); setComposerError(null); }}><Text className="font-heading-bold text-lime text-[10px] uppercase">Cancel</Text></Pressable></View> : null}
          <TextInput value={draft} onChangeText={(value) => { setDraft(value); setComposerError(null); }} multiline placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'} placeholderTextColor={colors.tertiaryText} className="min-h-[90px] rounded-button border border-border bg-card p-md font-body text-white" />
          <InlineFormError message={isOffline ? null : composerError} />
          <LimeButton label={replyTo ? 'Reply' : 'Post comment'} onPress={() => void submit()} loading={saving} disabled={!draft.trim()} />
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CommentRow({ comment, owner, busy, onRespect, onDelete, onReply }: { comment: Comment; owner: boolean; busy: boolean; onRespect: () => void; onDelete: () => void; onReply?: () => void }) { return <View className="gap-xs"><View className="flex-row items-center gap-md"><Text className="flex-1 font-heading-bold text-white text-[12px]">{comment.author}</Text>{owner ? <Pressable onPress={onDelete}><Feather name="trash-2" size={14} color="#FCA5A5" /></Pressable> : null}</View><Text className="font-body text-tertiary-text text-[13px] leading-[20px]">{comment.content}</Text><View className="flex-row items-center gap-lg"><Pressable onPress={onRespect} disabled={busy} className="min-h-[36px] flex-row items-center gap-xs active:opacity-75"><Feather name="heart" size={16} color={comment.user_liked ? colors.lime : colors.tertiaryText} /><Text className={`font-heading-bold text-[10px] uppercase ${comment.user_liked ? 'text-lime' : busy ? 'text-white/35' : 'text-tertiary-text'}`}>{comment.likes_count} RESPECT</Text></Pressable>{onReply ? <Pressable onPress={onReply} className="min-h-[36px] flex-row items-center gap-xs active:opacity-75"><Feather name="message-circle" size={16} color={colors.lime} /><Text className="font-heading-bold text-[10px] uppercase text-lime">REPLY</Text></Pressable> : null}</View></View>; }
