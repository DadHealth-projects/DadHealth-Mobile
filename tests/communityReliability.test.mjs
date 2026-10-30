import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Global and Circle feeds automatically request stable 50-post pages and expose retryable page errors', async () => {
  const [hook, screen] = await Promise.all([
    read('hooks/useCommunityFeed.ts'),
    read('screens/subscreens/CommunityFeedScreen.tsx'),
  ]);
  assert.match(hook, /const PAGE_SIZE = 50/);
  assert.match(hook, /loadMoreInFlight\.current/);
  assert.match(hook, /!existing\.has\(post\.id\)/);
  assert.match(hook, /setPaginationError\(`We could not load older/);
  assert.match(screen, /onScroll=\{onFeedScroll\}/);
  assert.match(screen, /contentOffset\.y \+ layoutMeasurement\.height >= contentSize\.height - 480/);
  assert.match(screen, /feed\.paginationError[\s\S]*?Retry/);
});

test('A lost post or comment response is checked by stable ID before a manual idempotent retry', async () => {
  const [create, thread] = await Promise.all([
    read('screens/subscreens/CreateCommunityPostScreen.tsx'),
    read('screens/subscreens/CommunityPostThreadScreen.tsx'),
  ]);
  for (const source of [create, thread]) {
    assert.match(source, /Crypto\.randomUUID\(\)/);
    assert.match(source, /\.upsert\(pending\.(?:payload), \{ onConflict: 'id', ignoreDuplicates: true \}\)/);
    assert.match(source, /\.select\('id'\)\.eq\('id', pending\.id\)/);
    assert.match(source, /Check (?:post|reply) status/);
    assert.match(source, /submissionUncertain|commentUncertain/);
  }
  assert.match(create, /No post was found\. You can safely try again\./);
  assert.match(thread, /No reply was found\. You can safely try again\./);
});

test('Hourly named-post conflict has safe copy; anonymous posts keep user_id null', async () => {
  const create = await read('screens/subscreens/CreateCommunityPostScreen.tsx');
  assert.match(create, /insertError\.code === '23505' && !anonymous/);
  assert.match(create, /already shared a named post this hour/);
  assert.match(create, /user_id: anonymous \? null : user\.id/);
  assert.doesNotMatch(create, /insertError\.message|insertError\.details/);
});

test('Community load failures have retries and trending failures are not shown as empty results', async () => {
  const [home, feed] = await Promise.all([
    read('screens/CommunityScreen.tsx'),
    read('screens/subscreens/CommunityFeedScreen.tsx'),
  ]);
  assert.match(home, /trendingError \? <RetryRow/);
  assert.match(home, /trendingCircleError \? <RetryRow/);
  assert.match(home, /trendingCircleLoading[\s\S]*?trendingCircleError \? null : trendingCirclePosts\.length === 0/);
  assert.match(home, /trendingError \? null : trendingTags\.length === 0/);
  assert.match(home, /We could not load trending topics/);
  assert.match(feed, /<ScreenErrorNotice message=\{circleError\} \/>/);
  assert.match(feed, /Try again/);
});

test('Community mutation handlers catch failures and always release busy state', async () => {
  const [actions, hook, thread] = await Promise.all([
    read('lib/communityPostActions.ts'),
    read('hooks/useCommunityFeed.ts'),
    read('screens/subscreens/CommunityPostThreadScreen.tsx'),
  ]);
  assert.match(actions, /catch \{[\s\S]*?We could not update this like/);
  assert.match(hook, /finally \{ otherActionLocks\.current\.delete\(postId\); setBusyId\(null\); \}/);
  assert.match(thread, /finally \{ postActionLock\.current = false; setPostActionBusy\(false\); \}/);
  assert.match(thread, /finally \{ respectLocks\.current\.delete\(comment\.id\); setRespectBusyId\(null\); \}/);
});
