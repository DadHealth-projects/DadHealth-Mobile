import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import { useAuth } from '../../contexts/AuthContext';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Comment = { id: string; user_id: string; content: string; parent_id: string | null; created_at: string; anonymous: boolean; author: string };

export default function CommunityPostThreadScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'CommunityPostThread'>>();
  const { user } = useAuth();
  const [post, setPost] = useState<{ content: string; author_name: string; anonymous: boolean; tag: string } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [postResult, commentResult] = await Promise.all([
      supabase.from('posts').select('content,author_name,anonymous,tag').eq('id', route.params.postId).maybeSingle(),
      supabase.from('comments').select('id,user_id,content,parent_id,created_at,anonymous').eq('post_id', route.params.postId).order('created_at', { ascending: true }),
    ]);
    if (postResult.error || commentResult.error || !postResult.data) { setError('We could not load this conversation. Please try again.'); setLoading(false); return; }
    const rows = commentResult.data ?? [];
    const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
    const profileResult = userIds.length ? await supabase.from('user_profile').select('user_id,display_name').in('user_id', userIds) : { data: [], error: null };
    const names = new Map((profileResult.data ?? []).map((profile: { user_id: string; display_name: string | null }) => [String(profile.user_id), profile.display_name?.trim() || 'Member']));
    setPost({ content: String(postResult.data.content), author_name: postResult.data.anonymous ? 'Anonymous' : String(postResult.data.author_name ?? 'Member'), anonymous: postResult.data.anonymous === true, tag: String(postResult.data.tag ?? '') });
    setComments(rows.map((row) => ({ id: String(row.id), user_id: String(row.user_id), content: String(row.content), parent_id: row.parent_id ? String(row.parent_id) : null, created_at: String(row.created_at), anonymous: row.anonymous === true, author: row.anonymous ? 'Anonymous' : names.get(String(row.user_id)) ?? (String(row.user_id) === user?.id ? 'You' : 'Member') })));
    setError(null); setLoading(false);
  }, [route.params.postId, user?.id]);

  useEffect(() => { void load(); const channel = supabase.channel(`mobile-thread-${route.params.postId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${route.params.postId}` }, () => void load()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [load, route.params.postId]);

  const roots = useMemo(() => comments.filter((comment) => !comment.parent_id), [comments]);
  const replies = useMemo(() => { const map = new Map<string, Comment[]>(); comments.filter((comment) => comment.parent_id).forEach((comment) => { const list = map.get(comment.parent_id!) ?? []; list.push(comment); map.set(comment.parent_id!, list); }); return map; }, [comments]);
  const submit = async () => {
    const content = draft.trim(); if (!content) return; if (!user?.id) { navigation.navigate('Login'); return; }
    setSaving(true); setError(null);
    if (replyTo) { const parent = comments.find((comment) => comment.id === replyTo); if (!parent || parent.parent_id) { setError('You can only reply to a main comment.'); setSaving(false); return; } }
    const { error: insertError } = await supabase.from('comments').insert({ user_id: user.id, post_id: route.params.postId, content, parent_id: replyTo });
    if (insertError) setError('We could not post your reply. Please try again.');
    else { trackEvent('comment_added', { post_id: route.params.postId, has_parent: Boolean(replyTo), content_length: content.length }, user.id); setDraft(''); setReplyTo(null); await load(); }
    setSaving(false);
  };
  const remove = (comment: Comment) => Alert.alert('Delete reply?', 'This reply will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void supabase.from('comments').delete().eq('id', comment.id).eq('user_id', user?.id).then(({ error: deleteError }) => { if (deleteError) setError('We could not delete this reply.'); else void load(); }) }]);

  return <SafeAreaView edges={['top']} className="flex-1 bg-dark"><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerClassName="px-lg pt-lg pb-xl gap-xl"><AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center" accessibilityLabel="Close post thread"><Feather name="x" size={20} color={colors.text} /></Pressable>} />{loading ? <View className="h-[240px] bg-white/5" /> : error && !post ? <View className="gap-md"><Text className="font-body text-red-300">{error}</Text><LimeButton label="Try again" onPress={() => void load()} /></View> : post ? <><View className="border-b border-border pb-xl"><View className="flex-row items-center gap-sm"><Text className="font-heading-bold text-lime text-[11px] uppercase">{post.tag}</Text><Text className="font-heading-bold text-white text-[14px]">{post.author_name}</Text></View><Text className="font-body text-white text-[18px] leading-[27px] mt-md">{post.content}</Text></View><View className="gap-md"><Text className="font-heading-bold text-lime text-[11px] uppercase">Replies</Text>{roots.length === 0 ? <Text className="font-body text-muted-text">No replies yet.</Text> : roots.map((comment) => <View key={comment.id} className="border-b border-border pb-md"><CommentRow comment={comment} owner={comment.user_id === user?.id} onDelete={() => remove(comment)} onReply={() => { setReplyTo(comment.id); setDraft(''); }} />{(replies.get(comment.id) ?? []).map((reply) => <View key={reply.id} className="ml-xl mt-md border-l-2 border-l-lime/30 pl-md"><CommentRow comment={reply} owner={reply.user_id === user?.id} onDelete={() => remove(reply)} /></View>)}</View>)}</View>{replyTo ? <View className="flex-row items-center justify-between"><Text className="font-body text-muted-text text-[12px]">Replying to {comments.find((comment) => comment.id === replyTo)?.author}</Text><Pressable onPress={() => setReplyTo(null)}><Text className="font-heading-bold text-lime text-[10px] uppercase">Cancel</Text></Pressable></View> : null}<TextInput value={draft} onChangeText={setDraft} multiline placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'} placeholderTextColor={colors.tertiaryText} className="min-h-[90px] rounded-button border border-border bg-card p-md font-body text-white" />{error ? <Text accessibilityRole="alert" className="font-body text-red-300 text-[12px]">{error}</Text> : null}<LimeButton label={replyTo ? 'Reply' : 'Post comment'} onPress={() => void submit()} loading={saving} disabled={!draft.trim()} /></> : null}</ScrollView></SafeAreaView>;
}

function CommentRow({ comment, owner, onDelete, onReply }: { comment: Comment; owner: boolean; onDelete: () => void; onReply?: () => void }) { return <View className="gap-xs"><View className="flex-row items-center gap-md"><Text className="flex-1 font-heading-bold text-white text-[12px]">{comment.author}</Text>{onReply ? <Pressable onPress={onReply}><Text className="font-heading-bold text-lime text-[10px] uppercase">Reply</Text></Pressable> : null}{owner ? <Pressable onPress={onDelete}><Feather name="trash-2" size={14} color="#FCA5A5" /></Pressable> : null}</View><Text className="font-body text-tertiary-text text-[13px] leading-[20px]">{comment.content}</Text></View>; }
