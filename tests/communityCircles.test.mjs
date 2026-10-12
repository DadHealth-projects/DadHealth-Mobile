import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('Circle posts keep topic tags and require selected member Circle', async () => {
  const [composer, nav] = await Promise.all([
    source('screens/subscreens/CreateCommunityPostScreen.tsx'),
    source('navigation/AppNavigator.tsx'),
  ]);
  assert.match(composer, /TAGS = \['FITNESS', 'MIND', 'BOND'\]/);
  assert.match(composer, /circle_id: circleId/);
  assert.match(composer, /Join this Dad Circle before posting/);
  assert.match(composer, /CreateCommunityPost: \{ circleId\?: string \}/);
  assert.match(nav, /CommunityFeed: \{ circleId\?: string \}/);
});

test('Circle feed scopes posts; global feed uses privacy-filtered RPC and Circle previews', async () => {
  const [hook, feed, community, thread, card, circleCard] = await Promise.all([
    source('hooks/useCommunityFeed.ts'),
    source('screens/subscreens/CommunityFeedScreen.tsx'),
    source('screens/CommunityScreen.tsx'),
    source('screens/subscreens/CommunityPostThreadScreen.tsx'),
    source('components/community/InteractiveFeedPost.tsx'),
    source('components/mockup/CircleCard.tsx'),
  ]);
  assert.match(hook, /\.eq\('circle_id', circleId\)/);
  assert.match(hook, /rpc\('get_community_global_feed'/);
  assert.match(hook, /if \(!circleId\) await writeCommunityCache/);
  assert.match(hook, /clearCirclePosts/);
  assert.match(community, /community-circle-memberships/);
  assert.match(feed, /CreateCommunityPost', circleId \? \{ circleId \}/);
  assert.match(community, /rpc\('get_trending_circle_posts'/);
  assert.match(community, /CommunityFeed', \{ circleId: id \}/);
  assert.match(community, /\{post\.circle_name\}/);
  assert.match(community, /\{post\.tag\}/);
  assert.match(card, /post\.circle_name \?/);
  assert.match(card, /post\.tag \?/);
  assert.match(card, /flex-row items-center gap-xs/);
  assert.match(thread, /post\.circle_name \?/);
  assert.match(thread, /post\.tag \?/);
  assert.match(thread, /flex-row flex-wrap items-center gap-xs/);
  assert.doesNotMatch(card, /Circle:|Tag:/);
  assert.doesNotMatch(thread, /Circle:|Tag:/);
  assert.match(community, /name=\{circle\.name\}/);
  assert.match(community, /description=\{circle\.description\}/);
  assert.match(circleCard, /\{name\}/);
  assert.match(circleCard, /\{description\}/);
  assert.doesNotMatch(circleCard, /Pressable[^>]*className="flex-1"/);
});

test('private Circle data stays out of local feed cache and post actions remain wired', async () => {
  const [hook, storage, thread] = await Promise.all([
    source('hooks/useCommunityFeed.ts'),
    source('lib/offlineStorage.ts'),
    source('screens/subscreens/CommunityPostThreadScreen.tsx'),
  ]);
  assert.match(storage, /community_v3/);
  assert.match(hook, /posts: nextPosts\.filter\(\(post\) => post\.circle_id === null\)/);
  assert.match(hook, /table: 'user_circles'/);
  assert.match(hook, /if \(!circleId\) await writeCommunityCache/);
  for (const text of ["from('comments').insert", "from('likes').upsert", "from('saved_posts').insert", "delete_own_community_post"]) {
    assert.ok(hook.includes(text) || thread.includes(text), `Missing existing action: ${text}`);
  }
  assert.match(thread, /from\('comments'\)\.insert/);
  assert.match(thread, /from\('comment_likes'\)\.upsert/);
});
