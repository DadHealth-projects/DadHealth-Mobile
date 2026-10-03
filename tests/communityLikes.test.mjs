import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('post likes are idempotent and serialize rapid toggles per user and post', async () => {
  const hook = await read('hooks/useCommunityFeed.ts');
  const start = hook.indexOf('const toggleLike = useCallback');
  const end = hook.indexOf('const toggleSave = useCallback', start);
  const toggleLike = hook.slice(start, end);

  assert.match(hook, /const postLikeMutationLocks = new Set<string>\(\)/);
  assert.match(toggleLike, /const mutationKey = `\$\{userId\}:\$\{postId\}`/);
  assert.ok(toggleLike.indexOf('postLikeMutationLocks.has(mutationKey)') < toggleLike.indexOf('postLikeMutationLocks.add(mutationKey)'));
  assert.match(toggleLike, /onConflict: 'user_id,post_id', ignoreDuplicates: true/);
  assert.match(toggleLike, /\.select\('post_id'\)/);
  assert.match(toggleLike, /if \(result\.data\?\.length === 0\) await refresh\(true\)/);
  assert.match(toggleLike, /\.delete\(\)\.eq\('user_id', userId\)\.eq\('post_id', postId\)\.select\('post_id'\)/);
  assert.match(toggleLike, /finally\s*\{[\s\S]*?postLikeMutationLocks\.delete\(mutationKey\)/);
  assert.doesNotMatch(toggleLike, /\.insert\(\{ user_id: userId, post_id: postId \}\)/);
});

test('post-like state is loaded and reconciled through the existing refresh/realtime flow', async () => {
  const [hook, screen] = await Promise.all([
    read('hooks/useCommunityFeed.ts'),
    read('screens/subscreens/CommunityFeedScreen.tsx'),
  ]);

  assert.match(hook, /from\('likes'\)\.select\('post_id'\)\.eq\('user_id', userId\)/);
  assert.match(hook, /table: 'likes'[\s\S]*?refresh\(true\)/);
  assert.match(screen, /feed\.busyId === post\.id \|\| feed\.likeBusyIds\.has\(post\.id\)/);
});
