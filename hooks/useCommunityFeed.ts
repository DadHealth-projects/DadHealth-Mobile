import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

export type CommunityFeedPost = { id: string; user_id: string | null; content: string; tag: string; anonymous: boolean; author_initials: string; author_name: string; author_meta: string; created_at: string; likes_count: number; replies_count: number };

let communityFeedChannelSequence = 0;

export function useCommunityFeed(userId?: string) {
  const [channelInstanceId] = useState(() => ++communityFeedChannelSequence);
  const [posts, setPosts] = useState<CommunityFeedPost[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [anonymousOwnedIds, setAnonymousOwnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const postResult = await supabase.from('posts').select('id,user_id,content,tag,anonymous,author_initials,author_name,author_meta,created_at').order('created_at', { ascending: false }).limit(50);
    if (postResult.error) { setError('We could not load the Community feed. Please try again.'); if (!silent) setLoading(false); return; }
    const rows = postResult.data ?? [];
    const ids = rows.map((row) => String(row.id));
    const [likesResult, commentsResult, userLikesResult, savesResult, anonymousOwnersResult] = await Promise.all([
      ids.length ? supabase.from('likes').select('post_id').in('post_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('comments').select('post_id').in('post_id', ids) : Promise.resolve({ data: [], error: null }),
      userId ? supabase.from('likes').select('post_id').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
      userId ? supabase.from('saved_posts').select('post_id').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
      userId ? supabase.from('anonymous_post_owners').select('post_id').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
    ]);
    if (likesResult.error || commentsResult.error) setError('We could not load all Community activity. Please try again.');
    const likeCounts = countByPost(likesResult.data ?? []);
    const replyCounts = countByPost(commentsResult.data ?? []);
    setPosts(rows.map((row) => ({ id: String(row.id), user_id: row.user_id ? String(row.user_id) : null, content: String(row.content ?? ''), tag: String(row.tag ?? ''), anonymous: row.anonymous === true, author_initials: normalizeInitials(row.author_initials, row.anonymous === true), author_name: normalizeName(row.author_name, row.anonymous === true), author_meta: typeof row.author_meta === 'string' ? row.author_meta : row.anonymous ? 'Anonymous · ' : 'Member · ', created_at: String(row.created_at), likes_count: likeCounts.get(String(row.id)) ?? 0, replies_count: replyCounts.get(String(row.id)) ?? 0 })));
    setLikedIds(new Set((userLikesResult.data ?? []).map((row: { post_id: string }) => String(row.post_id))));
    setSavedIds(new Set((savesResult.data ?? []).map((row: { post_id: string }) => String(row.post_id))));
    setAnonymousOwnedIds(new Set((anonymousOwnersResult.data ?? []).map((row: { post_id: string }) => String(row.post_id))));
    if (!silent) setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const channel = supabase.channel(`community-mobile-${userId ?? 'guest'}-${channelInstanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => void refresh(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => void refresh(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => void refresh(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_posts' }, () => void refresh(true)).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelInstanceId, refresh, userId]);

  const toggleLike = useCallback(async (postId: string) => {
    if (!userId) return 'Log in to like posts.';
    const liked = likedIds.has(postId); setBusyId(postId);
    setLikedIds((current) => { const next = new Set(current); liked ? next.delete(postId) : next.add(postId); return next; });
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, likes_count: Math.max(0, post.likes_count + (liked ? -1 : 1)) } : post));
    const result = liked ? await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId) : await supabase.from('likes').insert({ user_id: userId, post_id: postId });
    setBusyId(null); if (result.error) { await refresh(true); return 'We could not update this like.'; } return null;
  }, [likedIds, refresh, userId]);

  const toggleSave = useCallback(async (postId: string) => {
    if (!userId) return 'Log in to save posts.';
    const saved = savedIds.has(postId); setBusyId(postId);
    const result = saved ? await supabase.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId) : await supabase.from('saved_posts').insert({ user_id: userId, post_id: postId });
    setBusyId(null); if (result.error) return 'We could not update this saved post.';
    setSavedIds((current) => { const next = new Set(current); saved ? next.delete(postId) : next.add(postId); return next; }); return null;
  }, [savedIds, userId]);

  const deletePost = useCallback(async (postId: string) => { if (!userId) return 'Log in to delete posts.'; setBusyId(postId); const { data: deleted, error: deleteError } = await supabase.rpc('delete_own_community_post', { p_post_id: postId }); setBusyId(null); if (deleteError || deleted !== true) return 'We could not delete this post.'; await refresh(true); return null; }, [refresh, userId]);
  return { posts, likedIds, savedIds, anonymousOwnedIds, loading, busyId, error, refresh, toggleLike, toggleSave, deletePost };
}

function countByPost(rows: Array<{ post_id: string }>) { const counts = new Map<string, number>(); rows.forEach((row) => { const id = String(row.post_id); counts.set(id, (counts.get(id) ?? 0) + 1); }); return counts; }
function normalizeName(value: unknown, anonymous: boolean) { const name = typeof value === 'string' ? value.trim() : ''; if (anonymous) return !name || name === 'Anonymous Dad' ? 'Anonymous' : name; return !name || name === 'Dad' ? 'Member' : name; }
function normalizeInitials(value: unknown, anonymous: boolean) { if (anonymous) return '?'; const text = typeof value === 'string' ? value.trim() : ''; return text && !/^\?+$/.test(text) ? text.slice(0, 2).toUpperCase() : '?'; }
