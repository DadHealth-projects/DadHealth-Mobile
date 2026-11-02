import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createRealtimeRefreshScheduler,
  createRefreshDeduper,
  buildCommunityInFilters,
  isCommunityCommentChangeRelevant,
  isCommunityCommentLikeRelevant,
  isCommunityFeedChangeRelevant,
  isCommunityPostActivityChangeRelevant,
} from '../lib/communityRealtime.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('feed event relevance is scoped to the visible global or selected-circle feed', () => {
  const visiblePostIds = new Set(['visible-post']);
  const context = { circleId: null, visiblePostIds, userId: 'current-user' };

  assert.equal(isCommunityFeedChangeRelevant({ table: 'posts', eventType: 'INSERT', new: { circle_id: null } }, context), true);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'posts', eventType: 'INSERT', new: { circle_id: 'other-circle' } }, context), false);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'posts', eventType: 'DELETE', old: { id: 'visible-post' } }, context), true);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'posts', eventType: 'DELETE', old: { id: 'old-post' } }, context), false);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'posts', eventType: 'UPDATE', old: { id: 'visible-post' }, new: { id: 'visible-post', circle_id: 'other-circle' } }, context), true);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'likes', eventType: 'INSERT', new: { post_id: 'visible-post' } }, context), true);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'comments', eventType: 'INSERT', new: { post_id: 'other-post' } }, context), false);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'saved_posts', eventType: 'INSERT', new: { post_id: 'visible-post', user_id: 'other-user' } }, context), false);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'saved_posts', eventType: 'INSERT', new: { post_id: 'visible-post', user_id: 'current-user' } }, context), true);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'comments', eventType: 'DELETE', old: { id: 'deleted-comment' } }, context), true);

  assert.equal(isCommunityFeedChangeRelevant({ table: 'posts', eventType: 'INSERT', new: { circle_id: 'selected-circle' } }, { ...context, circleId: 'selected-circle' }), true);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'user_circles', eventType: 'DELETE', old: { user_id: 'other-user', circle_id: 'selected-circle' } }, context), false);
  assert.equal(isCommunityFeedChangeRelevant({ table: 'user_circles', eventType: 'DELETE', old: { user_id: 'current-user', circle_id: 'selected-circle' } }, context), true);
});

test('comment-like changes refresh only when the changed comment belongs to the open post', () => {
  const visibleCommentIds = new Set(['comment-a', 'comment-b']);
  assert.equal(isCommunityCommentLikeRelevant({ table: 'comment_likes', new: { comment_id: 'comment-a' } }, visibleCommentIds), true);
  assert.equal(isCommunityCommentLikeRelevant({ table: 'comment_likes', old: { comment_id: 'unrelated-comment' } }, visibleCommentIds), false);
  assert.equal(isCommunityCommentLikeRelevant({ table: 'likes', new: { comment_id: 'comment-a' } }, visibleCommentIds), false);
});

test('comment deletes with primary-key-only payloads refresh only for a displayed comment', () => {
  const visibleCommentIds = new Set(['visible-comment']);
  assert.equal(isCommunityCommentChangeRelevant({ table: 'comments', eventType: 'DELETE', old: { id: 'visible-comment' } }, 'open-post', visibleCommentIds), true);
  assert.equal(isCommunityCommentChangeRelevant({ table: 'comments', eventType: 'DELETE', old: { id: 'other-comment' } }, 'open-post', visibleCommentIds), false);
  assert.equal(isCommunityCommentChangeRelevant({ table: 'comments', eventType: 'DELETE', old: { id: 'other-comment', post_id: 'another-post' } }, 'open-post', visibleCommentIds), false);
  assert.equal(isCommunityCommentChangeRelevant({ table: 'comments', eventType: 'UPDATE', new: { id: 'new-comment', post_id: 'open-post' } }, 'open-post', visibleCommentIds), true);
});

test('post-detail like and save deletes use cached primary keys when relationship fields are absent', () => {
  const likeIds = new Set(['visible-like']);
  const savedIds = new Set(['visible-save']);
  assert.equal(isCommunityPostActivityChangeRelevant({ table: 'likes', eventType: 'DELETE', old: { id: 'visible-like' } }, 'open-post', likeIds, 'current-user'), true);
  assert.equal(isCommunityPostActivityChangeRelevant({ table: 'likes', eventType: 'DELETE', old: { id: 'other-like' } }, 'open-post', likeIds, 'current-user'), false);
  assert.equal(isCommunityPostActivityChangeRelevant({ table: 'saved_posts', eventType: 'DELETE', old: { id: 'visible-save' } }, 'open-post', savedIds, 'current-user'), true);
  assert.equal(isCommunityPostActivityChangeRelevant({ table: 'saved_posts', eventType: 'INSERT', new: { user_id: 'other-user', post_id: 'open-post' } }, 'open-post', savedIds, 'current-user'), false);
});

test('Realtime IN filters chunk every visible post without exceeding Supabase filter limits', () => {
  const postIds = Array.from({ length: 205 }, (_, index) => `post-${index}`);
  const filters = buildCommunityInFilters(postIds, 'post_id');
  assert.equal(filters.length, 3);
  assert.deepEqual(filters.map((filter) => filter.match(/post-\d+/g).length), [100, 100, 5]);
  assert.ok(filters.every((filter) => filter.startsWith('post_id=in.(')));
});

test('Realtime event bursts coalesce and never run overlapping refreshes', async () => {
  let runs = 0;
  let activeRuns = 0;
  let maximumActiveRuns = 0;
  const scheduler = createRealtimeRefreshScheduler(async () => {
    runs += 1;
    activeRuns += 1;
    maximumActiveRuns = Math.max(maximumActiveRuns, activeRuns);
    await new Promise((resolve) => setTimeout(resolve, 35));
    activeRuns -= 1;
  }, 8);

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  await new Promise((resolve) => setTimeout(resolve, 15));
  scheduler.schedule();
  scheduler.schedule();
  await new Promise((resolve) => setTimeout(resolve, 90));
  scheduler.dispose();

  assert.equal(runs, 2);
  assert.equal(maximumActiveRuns, 1);
});

test('same-context refresh dedupe queues one fresh pass and keeps different contexts separate', async () => {
  const dedupe = createRefreshDeduper();
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const calls = [];
  const first = dedupe('user:circle-a', async () => { calls.push('first'); await firstGate; });
  const duplicate = dedupe('user:circle-a', async () => { calls.push('superseded rerun'); });
  const latest = dedupe('user:circle-a', async () => { calls.push('latest rerun'); });
  const otherCircle = dedupe('user:circle-b', async () => { calls.push('circle-b'); });

  assert.equal(first, duplicate);
  assert.equal(first, latest);
  await otherCircle;
  releaseFirst();
  await first;

  assert.deepEqual(calls, ['first', 'circle-b', 'latest rerun']);
});

test('Community subscriptions are lifecycle-gated and duplicate Home membership listening is removed', async () => {
  const [feed, home, circle, details] = await Promise.all([
    read('hooks/useCommunityFeed.ts'),
    read('screens/CommunityScreen.tsx'),
    read('screens/subscreens/CommunityFeedScreen.tsx'),
    read('screens/subscreens/CommunityPostThreadScreen.tsx'),
  ]);

  assert.match(feed, /const focused = useIsFocused\(\)/);
  assert.match(feed, /screenActiveRef\.current = focused && appState === 'active'/);
  assert.match(feed, /appState !== 'active' \|\| isOffline \|\| !userId/);
  assert.match(feed, /AppState\.addEventListener\('change', setAppState\)/);
  assert.match(feed, /buildCommunityInFilters\(realtimePostIds, 'post_id'\)/);
  assert.match(feed, /posts\.map\(\(post\) => post\.id\)\.sort\(\)/);
  assert.match(feed, /communityFeedChannelSequence/);
  for (const table of ['posts', 'user_circles', 'likes', 'comments', 'saved_posts']) {
    const filteredListeners = feed.match(new RegExp(`event: '\\*', schema: 'public', table: '${table}'`, 'g')) ?? [];
    assert.equal(filteredListeners.length, 1, `${table} should use one all-event listener per filter chunk`);
  }
  assert.match(feed, /return \(\) => \{[\s\S]*?scheduler\.dispose\(\)[\s\S]*?supabase\.removeChannel\(channel\)/);
  assert.doesNotMatch(home, /supabase\.channel\(/);
  assert.match(home, /feed\.membershipEventVersion/);
  assert.match(circle, /feed\.membershipEventVersion/);
  assert.match(details, /useIsFocused\(\)/);
  assert.match(details, /screenActiveRef\.current = focused && appState === 'active'/);
  assert.match(details, /appState !== 'active'/);
  assert.match(details, /isOffline \|\| !user\?\.id/);
  assert.match(details, /isCommunityCommentLikeRelevant\(payload, commentIdsRef\.current\)/);
  assert.match(details, /isCommunityCommentChangeRelevant\(payload, route\.params\.postId, commentIdsRef\.current\)/);
  assert.match(details, /filter: `user_id=eq\.\$\{user\?\.id\},post_id=eq\.\$\{route\.params\.postId\}`/);
  assert.match(details, /scheduler\.dispose\(\)/);
});

test('trending topics are not refetched when feed posts change; offline tags still derive from cache', async () => {
  const home = await read('screens/CommunityScreen.tsx');
  const loadTrendingStart = home.indexOf('const loadTrending = useCallback');
  const loadTrendingEnd = home.indexOf('const loadTrendingCirclePosts', loadTrendingStart);
  const loadTrending = home.slice(loadTrendingStart, loadTrendingEnd);

  assert.match(loadTrending, /supabase\.rpc\('trending_post_tags'/);
  assert.doesNotMatch(loadTrending, /feed\.posts/);
  assert.match(home, /if \(!isOffline\) return;[\s\S]*?feed\.posts\.forEach/);
  assert.match(home, /useFocusEffect\(useCallback\(\(\) => \{[\s\S]*loadTrending\(\)/);
});
