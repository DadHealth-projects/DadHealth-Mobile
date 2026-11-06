import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { readCommunityCache, writeCommunityCache } from '../lib/offlineStorage';
import { loadCommunityAuthorAvatars } from '../lib/communityAuthorAvatars';
import { deleteCommunityPost, toggleCommunityPostLike, toggleCommunityPostSave } from '../lib/communityPostActions';
import { supabase } from '../lib/supabase';
import { buildCommunityInFilters, createRefreshDeduper, createRealtimeRefreshScheduler, isCommunityFeedChangeRelevant } from '../lib/communityRealtime.mjs';

export type CommunityFeedPost = { id: string; user_id: string | null; content: string; tag: string; circle_id: string | null; circle_name: string | null; anonymous: boolean; author_initials: string; author_name: string; author_meta: string; avatar_url: string | null; created_at: string; likes_count: number; replies_count: number };

type CommunityPostRow = {
  id: string;
  user_id: string | null;
  content: string;
  tag: string;
  circle_id: string | null;
  anonymous: boolean | null;
  author_initials: string | null;
  author_name: string | null;
  author_meta: string | null;
  created_at: string | null;
};

type CommunityChangePayload = {
  table?: string;
  eventType?: string;
  old?: Record<string, unknown>;
  new?: Record<string, unknown>;
};

let communityFeedChannelSequence = 0;
const PAGE_SIZE = 50;

function getInitialAppState(): AppStateStatus {
  const state = AppState.currentState;
  return state === 'active' || state === 'background' || state === 'inactive' || state === 'extension' || state === 'unknown'
    ? state
    : 'unknown';
}

export function useCommunityFeed(userId?: string, circleId?: string) {
  const { isOffline } = useNetworkStatus();
  const focused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(getInitialAppState);
  const screenActiveRef = useRef(false);
  screenActiveRef.current = focused && appState === 'active';
  const [posts, setPosts] = useState<CommunityFeedPost[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [anonymousOwnedIds, setAnonymousOwnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [likeBusyIds, setLikeBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showingCached, setShowingCached] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const nextOffset = useRef(0);
  const loadMoreInFlight = useRef(false);
  const likeLocks = useRef(new Set<string>());
  const otherActionLocks = useRef(new Set<string>());
  const requestSequence = useRef(0);
  const refreshDeduper = useRef(createRefreshDeduper());
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const realtimePostIds = posts.map((post) => post.id).sort();
  const realtimePostIdsKey = realtimePostIds.join(',');
  const realtimePostIdFilters = buildCommunityInFilters(realtimePostIds, 'post_id');
  const [membershipEventVersion, setMembershipEventVersion] = useState(0);
  const cacheOwner = useRef<string | null>(userId ?? null);
  const clearCirclePosts = useCallback(() => {
    setPosts((current) => current.filter((post) => post.circle_id === null));
    setLikedIds(new Set());
    setSavedIds(new Set());
    setAnonymousOwnedIds(new Set());
  }, []);

  const refresh = useCallback((silent = false): Promise<void> => {
    const nextOwner = userId ?? null;
    const requestKey = `${nextOwner ?? 'guest'}:${circleId ?? 'global'}`;
    return refreshDeduper.current(requestKey, async () => {
    if (!screenActiveRef.current) return;
    const requestId = ++requestSequence.current;
    if (!silent) setLoading(true);
    setError(null);
    setPaginationError(null);
    nextOffset.current = 0;
    setHasMore(false);

    if (cacheOwner.current !== nextOwner) {
      cacheOwner.current = nextOwner;
      setPosts([]);
      setLikedIds(new Set());
      setSavedIds(new Set());
      setAnonymousOwnedIds(new Set());
      setShowingCached(false);
    }

    let hasCachedPosts = false;
    try {
    if (!circleId) {
      try {
        const cached = await readCommunityCache<CommunityFeedPost>(userId);
        if (requestId !== requestSequence.current) return;
        if (cached) {
          setPosts(cached.posts);
          setLikedIds(new Set(cached.likedIds));
          setSavedIds(new Set(cached.savedIds));
          setAnonymousOwnedIds(new Set(cached.anonymousOwnedIds));
          hasCachedPosts = cached.posts.length > 0;
          if (!silent) setLoading(false);
        }
      } catch {
        hasCachedPosts = false;
      }
    } else {
      nextOffset.current = 0;
      setHasMore(false);
      setPosts([]);
      setLikedIds(new Set());
      setSavedIds(new Set());
      setAnonymousOwnedIds(new Set());
    }

    if (isOffline) {
      setShowingCached(hasCachedPosts);
      setLoading(false);
      return;
    }

    const postResult = circleId
      ? await supabase.from('posts').select('id,user_id,content,tag,circle_id,anonymous,author_initials,author_name,author_meta,created_at').eq('circle_id', circleId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, PAGE_SIZE - 1).overrideTypes<CommunityPostRow[], { merge: false }>()
      : await supabase.from('posts').select('id,user_id,content,tag,circle_id,anonymous,author_initials,author_name,author_meta,created_at').is('circle_id', null).order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, PAGE_SIZE - 1).overrideTypes<CommunityPostRow[], { merge: false }>();
    if (requestId !== requestSequence.current) return;
    if (postResult.error) {
      if (!hasCachedPosts) setError('We could not load the Community feed. Please try again.');
      else setShowingCached(true);
      setLoading(false);
      return;
    }

    const rows: CommunityPostRow[] = Array.isArray(postResult.data) ? postResult.data : [];
    nextOffset.current = rows.length;
    setHasMore(rows.length === PAGE_SIZE);
    const hydrated = await hydratePosts(rows, userId);
    if (requestId !== requestSequence.current) return;
    if (hydrated.activityError) setError('We could not load all Community activity. Please try again.');

    setPosts(hydrated.posts);
    setLikedIds(hydrated.likedIds);
    setSavedIds(hydrated.savedIds);
    setAnonymousOwnedIds(hydrated.anonymousOwnedIds);
    setShowingCached(false);
    try {
      if (!circleId) await writeCommunityCache(userId, {
        // Circle posts depend on live membership. Cache legacy global posts only.
        posts: hydrated.posts.filter((post) => post.circle_id === null),
        likedIds: [...hydrated.likedIds].filter((id) => hydrated.posts.some((post) => post.id === id && post.circle_id === null)),
        savedIds: [...hydrated.savedIds].filter((id) => hydrated.posts.some((post) => post.id === id && post.circle_id === null)),
        anonymousOwnedIds: [...hydrated.anonymousOwnedIds].filter((id) => hydrated.posts.some((post) => post.id === id && post.circle_id === null)),
      });
    } catch {
      // Keep the successfully loaded online feed available in memory.
    }
    setLoading(false);
    } catch {
      if (requestId === requestSequence.current) {
        setError('We could not load the Community feed. Please try again.');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
    });
  }, [circleId, isOffline, userId]);

  const loadMore = useCallback(async () => {
    if (isOffline || loading || loadingMore || !hasMore || loadMoreInFlight.current) return;
    loadMoreInFlight.current = true;
    const requestId = requestSequence.current;
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const pageQuery = supabase.from('posts').select('id,user_id,content,tag,circle_id,anonymous,author_initials,author_name,author_meta,created_at');
      const { data, error: pageError } = circleId
        ? await pageQuery.eq('circle_id', circleId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(nextOffset.current, nextOffset.current + PAGE_SIZE - 1).overrideTypes<CommunityPostRow[], { merge: false }>()
        : await pageQuery.is('circle_id', null).order('created_at', { ascending: false }).order('id', { ascending: false }).range(nextOffset.current, nextOffset.current + PAGE_SIZE - 1).overrideTypes<CommunityPostRow[], { merge: false }>();
      if (requestId !== requestSequence.current) return;
      if (pageError) {
        setPaginationError(`We could not load older ${circleId ? 'Circle' : 'community'} posts. Please try again.`);
        return;
      }
      const rows: CommunityPostRow[] = Array.isArray(data) ? data : [];
      const page = await hydratePosts(rows, userId);
      if (requestId !== requestSequence.current) return;
      if (page.activityError) {
        setPaginationError('We could not load engagement for older posts. Please try again.');
        return;
      }
      setPosts((current) => {
        const existing = new Set(current.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !existing.has(post.id))];
      });
      setLikedIds((current) => new Set([...current, ...page.likedIds]));
      setSavedIds((current) => new Set([...current, ...page.savedIds]));
      setAnonymousOwnedIds((current) => new Set([...current, ...page.anonymousOwnedIds]));
      nextOffset.current += rows.length;
      setHasMore(rows.length === PAGE_SIZE);
      setError(null);
      setPaginationError(null);
    } catch {
      setPaginationError(`We could not load older ${circleId ? 'Circle' : 'community'} posts. Please try again.`);
    } finally {
      loadMoreInFlight.current = false;
      setLoadingMore(false);
    }
  }, [circleId, hasMore, isOffline, loading, loadingMore, userId]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', setAppState);
    return () => appStateSubscription.remove();
  }, []);

  useEffect(() => {
    if (focused && appState === 'active') void refresh();
    return () => { requestSequence.current += 1; };
  }, [appState, focused, refresh]);

  useEffect(() => {
    if (!focused || appState !== 'active' || isOffline || !userId) return;

    const scheduler = createRealtimeRefreshScheduler(() => refresh(true));
    const channelId = `${Date.now()}-${++communityFeedChannelSequence}`;
    const handleMembershipChange = (payload: CommunityChangePayload) => {
      if (!isCommunityFeedChangeRelevant(payload, { circleId, visiblePostIds: new Set(), userId })) return;
      setMembershipEventVersion((version) => version + 1);
      const changedCircleIds = [payload.old, payload.new].flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const changedCircleId = row.circle_id;
        return typeof changedCircleId === 'string' ? [changedCircleId] : [];
      });
      if (circleId && (changedCircleIds.length === 0 || changedCircleIds.includes(circleId))) {
        clearCirclePosts();
        scheduler.schedule();
      }
    };
    let channel = supabase.channel(`community-mobile-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        const visiblePostIds = new Set(postsRef.current.map((post) => post.id));
        if (isCommunityFeedChangeRelevant(payload, { circleId, visiblePostIds, userId })) scheduler.schedule();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_circles', filter: `user_id=eq.${userId}` }, handleMembershipChange);

    for (const postIdFilter of realtimePostIdFilters) {
      channel = channel
        // One filtered listener per table and ID chunk covers INSERT/UPDATE/
        // DELETE. DELETE filters may not be applied by Postgres Changes, so
        // relevance is checked against the payload and visible post IDs.
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: postIdFilter }, (payload) => {
          const visiblePostIds = new Set(postsRef.current.map((post) => post.id));
          if (isCommunityFeedChangeRelevant(payload, { circleId, visiblePostIds, userId })) scheduler.schedule();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: postIdFilter }, (payload) => {
          const visiblePostIds = new Set(postsRef.current.map((post) => post.id));
          if (isCommunityFeedChangeRelevant(payload, { circleId, visiblePostIds, userId })) scheduler.schedule();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_posts', filter: `user_id=eq.${userId},${postIdFilter}` }, (payload) => {
          const visiblePostIds = new Set(postsRef.current.map((post) => post.id));
          if (isCommunityFeedChangeRelevant(payload, { circleId, visiblePostIds, userId })) scheduler.schedule();
        });
    }
    channel.subscribe();

    return () => {
      scheduler.dispose();
      void supabase.removeChannel(channel);
    };
  }, [appState, circleId, clearCirclePosts, focused, isOffline, realtimePostIdsKey, refresh, userId]);

  const toggleLike = useCallback(async (postId: string) => {
    if (!userId) return 'Log in to like posts.';
    if (isOffline || likeLocks.current.has(postId)) return null;
    likeLocks.current.add(postId);
    const liked = likedIds.has(postId);
    setLikeBusyIds((current) => new Set(current).add(postId));
    setLikedIds((current) => { const next = new Set(current); liked ? next.delete(postId) : next.add(postId); return next; });
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, likes_count: Math.max(0, post.likes_count + (liked ? -1 : 1)) } : post));
    try {
      const error = await toggleCommunityPostLike(userId, postId, liked);
      if (error) {
        await refresh(true);
        return error;
      }
      return null;
    } catch {
      await refresh(true);
      return 'We could not update this like. Please try again.';
    } finally {
      likeLocks.current.delete(postId);
      setLikeBusyIds((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }
  }, [isOffline, likedIds, refresh, userId]);

  const toggleSave = useCallback(async (postId: string) => {
    if (!userId) return 'Log in to save posts.';
    if (isOffline || otherActionLocks.current.has(postId)) return null;
    otherActionLocks.current.add(postId);
    const saved = savedIds.has(postId); setBusyId(postId);
    try {
      const error = await toggleCommunityPostSave(userId, postId, saved);
      if (error) return error;
      setSavedIds((current) => { const next = new Set(current); saved ? next.delete(postId) : next.add(postId); return next; }); return null;
    } catch {
      return 'We could not update this saved post. Please try again.';
    } finally { otherActionLocks.current.delete(postId); setBusyId(null); }
  }, [isOffline, savedIds, userId]);

  const deletePost = useCallback(async (postId: string) => {
    if (!userId) return 'Log in to delete posts.';
    if (isOffline || otherActionLocks.current.has(postId)) return null;
    otherActionLocks.current.add(postId);
    setBusyId(postId);
    try {
      const deleteError = await deleteCommunityPost(userId, postId);
      if (deleteError) return deleteError;
      await refresh(true);
      return null;
    } catch {
      return 'We could not delete this post. Please try again.';
    } finally { otherActionLocks.current.delete(postId); setBusyId(null); }
  }, [isOffline, refresh, userId]);

  return { posts, likedIds, savedIds, anonymousOwnedIds, loading, loadingMore, hasMore, paginationError, busyId, likeBusyIds, error, showingCached, isOffline, refresh, loadMore, clearCirclePosts, membershipEventVersion, toggleLike, toggleSave, deletePost };
}

async function hydratePosts(rows: CommunityPostRow[], userId?: string) {
  const ids = rows.map((row) => String(row.id));
  const circleIds = [...new Set(rows.map((row) => row.circle_id ? String(row.circle_id) : '').filter(Boolean))];
  const [likesResult, commentsResult, userLikesResult, savesResult, anonymousOwnersResult, circlesResult, avatarUrls] = await Promise.all([
    ids.length ? supabase.from('likes').select('post_id').in('post_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from('comments').select('post_id').in('post_id', ids) : Promise.resolve({ data: [], error: null }),
    userId && ids.length ? supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', ids) : Promise.resolve({ data: [], error: null }),
    userId && ids.length ? supabase.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids) : Promise.resolve({ data: [], error: null }),
    userId && ids.length ? supabase.from('anonymous_post_owners').select('post_id').eq('user_id', userId).in('post_id', ids) : Promise.resolve({ data: [], error: null }),
    circleIds.length ? supabase.from('circles').select('id,name').in('id', circleIds) : Promise.resolve({ data: [], error: null }),
    loadCommunityAuthorAvatars(rows.map((row) => ({ contribution_id: String(row.id), kind: 'post' as const, anonymous: row.anonymous === true }))),
  ]);
  const likeCounts = countByPost(likesResult.data ?? []);
  const replyCounts = countByPost(commentsResult.data ?? []);
  const circleNames = new Map((circlesResult.data ?? []).map((circle: { id: string; name: string }) => [String(circle.id), String(circle.name)]));
  return {
    posts: rows.map((row) => ({
      id: String(row.id), user_id: row.user_id ? String(row.user_id) : null,
      content: String(row.content ?? ''), tag: String(row.tag ?? ''),
      circle_id: row.circle_id ? String(row.circle_id) : null,
      circle_name: row.circle_id ? circleNames.get(String(row.circle_id)) ?? null : null,
      anonymous: row.anonymous === true,
      author_initials: normalizeInitials(row.author_initials, row.anonymous === true),
      author_name: normalizeName(row.author_name, row.anonymous === true),
      author_meta: typeof row.author_meta === 'string' ? row.author_meta : row.anonymous ? 'Anonymous · ' : 'Member · ',
      avatar_url: row.anonymous === true ? null : avatarUrls.get(String(row.id)) ?? null,
      created_at: String(row.created_at), likes_count: likeCounts.get(String(row.id)) ?? 0,
      replies_count: replyCounts.get(String(row.id)) ?? 0,
    })),
    likedIds: new Set((userLikesResult.data ?? []).map((row: { post_id: string }) => String(row.post_id))),
    savedIds: new Set((savesResult.data ?? []).map((row: { post_id: string }) => String(row.post_id))),
    anonymousOwnedIds: new Set((anonymousOwnersResult.data ?? []).map((row: { post_id: string }) => String(row.post_id))),
    activityError: Boolean(likesResult.error || commentsResult.error || userLikesResult.error || savesResult.error || anonymousOwnersResult.error || circlesResult.error),
  };
}

function countByPost(rows: Array<{ post_id: string }>) { const counts = new Map<string, number>(); rows.forEach((row) => { const id = String(row.post_id); counts.set(id, (counts.get(id) ?? 0) + 1); }); return counts; }
function normalizeName(value: unknown, anonymous: boolean) { const name = typeof value === 'string' ? value.trim() : ''; if (anonymous) return !name || name === 'Anonymous Dad' ? 'Anonymous' : name; return !name || name === 'Dad' ? 'Member' : name; }
function normalizeInitials(value: unknown, anonymous: boolean) { if (anonymous) return '?'; const text = typeof value === 'string' ? value.trim() : ''; return text && !/^\?+$/.test(text) ? text.slice(0, 2).toUpperCase() : '?'; }
