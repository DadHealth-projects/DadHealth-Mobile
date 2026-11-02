import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('post likes are idempotent and serialize rapid toggles per user and post', async () => {
  const [hook, actions] = await Promise.all([read('hooks/useCommunityFeed.ts'), read('lib/communityPostActions.ts')]);
  const start = hook.indexOf('const toggleLike = useCallback');
  const end = hook.indexOf('const toggleSave = useCallback', start);
  const toggleLike = hook.slice(start, end);

  assert.match(actions, /const likeMutationLocks = new Set<string>\(\)/);
  assert.match(actions, /const key = `\$\{userId\}:\$\{postId\}`/);
  assert.ok(actions.indexOf('likeMutationLocks.has(key)') < actions.indexOf('likeMutationLocks.add(key)'));
  assert.match(actions, /onConflict: 'user_id,post_id', ignoreDuplicates: true/);
  assert.match(actions, /\.select\('post_id'\)/);
  assert.match(actions, /\.delete\(\)\.eq\('user_id', userId\)\.eq\('post_id', postId\)\.select\('post_id'\)/);
  assert.match(actions, /finally\s*\{[\s\S]*?likeMutationLocks\.delete\(key\)/);
  assert.match(toggleLike, /setLikedIds/);
  assert.match(toggleLike, /await toggleCommunityPostLike\(userId, postId, liked\)/);
  assert.match(toggleLike, /await refresh\(true\)/);
});

test('post-like state is loaded and reconciled through the existing refresh/realtime flow', async () => {
  const [hook, screen, actions] = await Promise.all([
    read('hooks/useCommunityFeed.ts'),
    read('screens/subscreens/CommunityFeedScreen.tsx'),
    read('lib/communityPostActions.ts'),
  ]);

  assert.match(hook, /from\('likes'\)\.select\('post_id'\)\.eq\('user_id', userId\)\.in\('post_id', ids\)/);
  assert.match(actions, /toggleCommunityPostLike/);
  assert.match(hook, /table: 'likes'[\s\S]*?refresh\(true\)/);
  assert.match(screen, /feed\.busyId === post\.id \|\| feed\.likeBusyIds\.has\(post\.id\)/);
});

test('Community feed realtime listeners filter by visible records and require an active authenticated screen', async () => {
  const hook = await read('hooks/useCommunityFeed.ts');

  assert.match(hook, /useIsFocused\(\)/);
  assert.match(hook, /appState !== 'active' \|\| isOffline \|\| !userId/);
  assert.match(hook, /filter: `user_id=eq\.\$\{userId\}`/);
  assert.match(hook, /isCommunityFeedChangeRelevant\(payload/);
  assert.match(hook, /scheduler\.schedule\(\)/);
  assert.match(hook, /scheduler\.dispose\(\)/);
  assert.match(hook, /supabase\.removeChannel\(channel\)/);
});
