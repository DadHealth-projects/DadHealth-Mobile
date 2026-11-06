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
  assert.match(composer, /circle_id: route\.params\?\.circleId \? circleId : null/);
  assert.match(composer, /Join this Dad Circle before posting/);
  assert.match(nav, /CreateCommunityPost: \{ circleId\?: string \} \| undefined/);
  assert.match(nav, /CommunityFeed: \{ circleId\?: string \} \| undefined/);
});

test('Circle feed scopes posts; Community Conversations reads global posts only', async () => {
  const [hook, feed, community, thread, card, circleCard] = await Promise.all([
    source('hooks/useCommunityFeed.ts'),
    source('screens/subscreens/CommunityFeedScreen.tsx'),
    source('screens/CommunityScreen.tsx'),
    source('screens/subscreens/CommunityPostThreadScreen.tsx'),
    source('components/community/InteractiveFeedPost.tsx'),
    source('components/mockup/CircleCard.tsx'),
  ]);
  assert.match(hook, /\.eq\('circle_id', circleId\)/);
  assert.match(hook, /\.is\('circle_id', null\)/);
  assert.doesNotMatch(hook, /rpc\('get_community_global_feed'/);
  assert.match(hook, /if \(!circleId\) await writeCommunityCache/);
  assert.match(hook, /clearCirclePosts/);
  assert.doesNotMatch(community, /supabase\.channel\(/);
  assert.match(hook, /table: 'user_circles', filter: `user_id=eq\.\$\{userId\}`/);
  assert.match(hook, /membershipEventVersion/);
  assert.match(feed, /CreateCommunityPost', circleId \? \{ circleId \}/);
  assert.match(community, /navigation\.navigate\('CommunityFeed', \{ circleId \}\)/);
  assert.match(circleCard, /onOpen\(id\)/);
  assert.match(circleCard, /className="flex-col rounded-card border border-border bg-card p-md/);
  assert.match(circleCard, /Joined ✓/);
  assert.doesNotMatch(circleCard, /onToggle|Leave|Join</);
  assert.match(community, /rpc\('get_trending_circle_posts'/);
  assert.match(community, /navigation\.navigate\('CommunityFeed'\)/);
  assert.match(community, /\{post\.circle_name\}/);
  assert.match(community, /communityTagLabel\(post\.tag\)/);
  assert.match(card, /post\.circle_name \?/);
  assert.match(card, /post\.tag \?/);
  assert.match(card, /flex-row items-center gap-xs/);
  assert.match(thread, /post\.circle_name \?/);
  assert.match(thread, /post\.tag \?/);
  assert.match(thread, /post\.circle_name \?/);
  assert.match(thread, /post\.tag \?/);
  assert.doesNotMatch(card, /Circle:|Tag:/);
  assert.doesNotMatch(thread, /Circle:|Tag:/);
  assert.match(community, /name=\{circle\.name\}/);
  assert.match(community, /description=\{circle\.description\}/);
  assert.match(circleCard, /\{name\}/);
  assert.match(circleCard, /\{description\}/);
  assert.match(circleCard, /accessibilityLabel=\{`Open \$\{name\} Circle`\}/);
});

test('Circle thread hides posts from nonmembers and keeps member-only composer', async () => {
  const feed = await source('screens/subscreens/CommunityFeedScreen.tsx');
  assert.match(feed, /useCommunityFeed\(user\?\.id, circleId\)/);
  assert.match(feed, /select\('id,icon,name,description,members_count,visibility'\)\.eq\('id', circleId\)/);
  assert.doesNotMatch(feed, /circle_prompts|Official Circle prompt/);
  assert.match(feed, /Create Post/);
  assert.match(feed, /Join Circle/);
  assert.match(feed, /circleJoined === true/);
  assert.match(feed, /<Modal visible=\{leaveConfirmationOpen\}/);
  assert.match(feed, /Leave this circle\?/);
  assert.match(feed, /You can always come back\. Leaving means you won't see this circle's conversations here until you join again\./);
  assert.match(feed, /activeCircleTab/);
  assert.match(feed, /This circle is here when you need it\./);
  assert.match(feed, /circleId && circleJoined !== true/);
  assert.match(feed, /navigation\.navigate\('CreateCommunityPost', circleId \? \{ circleId \} : undefined\)/);
  assert.match(feed, /useFocusEffect[\s\S]*?loadCircle\(true\)/);
  assert.match(feed, /feed\.refresh\(\)/);
  assert.match(feed, /feed\.loadMore\(\)/);
});

test('Community home follows approved order, keeps global posts, and removes Recent Posts section', async () => {
  const [community, navigation, mind] = await Promise.all([
    source('screens/CommunityScreen.tsx'),
    source('navigation/AppNavigator.tsx'),
    source('screens/MindScreen.tsx'),
  ]);
  const labelStart = community.indexOf('Dad Health Community');
  const headlineStart = community.indexOf('Community Feed');
  const onlineCountStart = community.indexOf('onlinePresence.status ===');
  const circleStart = community.indexOf('<SectionHeader title="Your Dad Circles"');
  const trendStart = community.indexOf('<SectionHeader title="Trending in Dad Circles"');
  const topicsStart = community.indexOf('<SectionHeader title="Trending topics"');
  const liveStart = community.indexOf('<SectionHeader title="Live sessions"');
  assert.ok(labelStart >= 0 && headlineStart > labelStart && onlineCountStart > headlineStart);
  assert.ok(circleStart > onlineCountStart);
  assert.ok(liveStart > circleStart && trendStart > liveStart && topicsStart > trendStart);
  assert.equal(community.includes('<SectionHeader title="Start a conversation"'), false);
  assert.equal(community.includes('circlePrompts'), false);
  assert.equal(community.includes('<SectionHeader title="Recent posts"'), false);
  assert.match(community, /Community Conversations/);
  assert.match(community, /navigation\.navigate\('CommunityFeed'\)/);
  assert.match(community, /communityCircles\.map\(\(circle\) =>/);
  assert.doesNotMatch(community, /Math\.ceil\(communityCircles\.length \/ 2\)/);
  assert.match(navigation, /name="CommunityFeed"/);
  assert.match(mind, /navigation\.navigate\('Tabs', \{ screen: 'Squad' \}\)/);
  assert.match(community, /rows\.slice\(0, 4\)/);
  assert.match(community, /second\.count - first\.count/);
  assert.match(community, /navigation\.navigate\('CommunityPostThread'/);
  assert.match(community, /onSelectDashboardSection=\{onSelectDashboardSection\}/);
});

test('private Circle data stays out of local feed cache and post actions remain wired', async () => {
  const [hook, storage, thread, actions] = await Promise.all([
    source('hooks/useCommunityFeed.ts'),
    source('lib/offlineStorage.ts'),
    source('screens/subscreens/CommunityPostThreadScreen.tsx'),
    source('lib/communityPostActions.ts'),
  ]);
  assert.match(storage, /community_v3/);
  assert.match(hook, /posts: hydrated\.posts\.filter\(\(post\) => post\.circle_id === null\)/);
  assert.match(hook, /table: 'user_circles'/);
  assert.match(hook, /if \(!circleId\) await writeCommunityCache/);
  assert.match(thread, /from\('comments'\)\.upsert/);
  assert.match(actions, /from\('likes'\)\.upsert/);
  assert.match(actions, /from\('saved_posts'\)\.insert/);
  assert.match(actions, /delete_own_community_post/);
  assert.match(thread, /from\('comments'\)\.upsert/);
  assert.match(thread, /from\('comment_likes'\)\.upsert/);
});

test('Circle and global pagination are newest-first and open older posts without duplicates', async () => {
  const hook = await source('hooks/useCommunityFeed.ts');
  assert.match(hook, /\.order\('created_at', \{ ascending: false \}\)\.order\('id', \{ ascending: false \}\)\.range\(0, PAGE_SIZE - 1\)/);
  assert.match(hook, /\.range\(nextOffset\.current, nextOffset\.current \+ PAGE_SIZE - 1\)/);
  assert.match(hook, /pageQuery\.is\('circle_id', null\)/);
  assert.match(hook, /pageQuery\.eq\('circle_id', circleId\)/);
  assert.match(hook, /!existing\.has\(post\.id\)/);
  assert.match(hook, /setHasMore\(rows\.length === PAGE_SIZE\)/);
});

test('Post Details preserves the same post route and exposes post engagement and owner deletion', async () => {
  const [screen, navigation, actions] = await Promise.all([
    source('screens/subscreens/CommunityPostThreadScreen.tsx'),
    source('navigation/AppNavigator.tsx'),
    source('lib/communityPostActions.ts'),
  ]);
  assert.match(navigation, /CommunityPostThread: \{ postId: string \}/);
  assert.match(screen, /route\.params\.postId/);
  assert.match(screen, /toggleCommunityPostLike/);
  assert.match(screen, /toggleCommunityPostSave/);
  assert.match(screen, /deleteCommunityPost/);
  assert.match(screen, /row\.anonymous \? 'Anonymous'/);
  assert.match(screen, /replies_count: rows\.length/);
  assert.match(actions, /delete_own_community_post/);
});

test('Create Post preserves Circle context and General posts use null circle_id', async () => {
  const [create, feed] = await Promise.all([
    source('screens/subscreens/CreateCommunityPostScreen.tsx'),
    source('screens/subscreens/CommunityFeedScreen.tsx'),
  ]);
  assert.match(create, /useState<string \| null>\(route\.params\?\.circleId \?\? null\)/);
  assert.match(create, /requested && !available\.some/);
  assert.match(create, /route\.params\?\.circleId \? circleId : null/);
  assert.match(create, /if \(!requested \|\| !user\?\.id \|\| isOffline\)/);
  assert.match(create, /Boolean\(route\.params\?\.circleId\) && !circleId/);
  assert.match(create, /savingRef\.current/);
  assert.match(create, /navigation\.goBack\(\)/);
  assert.match(feed, /useFocusEffect/);
  assert.match(feed, /useFocusEffect/);
  assert.match(feed, /feed\.refresh\(\)/);
});

test('readable top-level comments from any author can receive replies', async () => {
  const [thread, policies] = await Promise.all([
    source('screens/subscreens/CommunityPostThreadScreen.tsx'),
    source('../dadHealth/supabase/rls-policies.sql'),
  ]);

  assert.match(thread, /roots\.map\(\(comment\)[\s\S]*?onReply=\{\(\) => \{ setReplyTo\(comment\.id\)/);
  assert.match(thread, /payload: \{ id, user_id: user\.id, post_id: route\.params\.postId, content, parent_id: replyTo \}/);
  assert.match(policies, /create policy "Members can comment on readable posts" on comments for insert to authenticated with check \(auth\.uid\(\) = user_id and public\.can_read_community_post\(post_id\)\)/);
});
