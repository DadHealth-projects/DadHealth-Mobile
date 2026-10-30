import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { countUniquePresenceUsers } from '../lib/communityPresenceCount.mjs';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('Community Presence counts users, not concurrent connections', () => {
  const state = {
    'user-a': [{ connection: 'phone' }, { connection: 'tablet' }],
    'user-b': [{}],
  };

  assert.equal(countUniquePresenceUsers(state), 2);
  assert.equal(countUniquePresenceUsers({}), 0);
});

test('Community Presence tracks only authenticated focused foreground sessions and removes channels', async () => {
  const hook = await source('hooks/useCommunityPresence.ts');

  assert.match(hook, /useIsFocused\(\)/);
  assert.match(hook, /appState === 'active'/);
  assert.match(hook, /private: true/);
  assert.match(hook, /presence: \{ key: authenticatedUserId \}/);
  assert.match(hook, /channel\.track\(\{\}\)/);
  assert.match(hook, /channel\.untrack\(\)/);
  assert.match(hook, /supabase\.removeChannel\(channel\)/);
  assert.match(hook, /PRESENCE_SYNC_TIMEOUT_MS/);
  assert.match(hook, /status: 'unavailable', count: null/);
  const subscribedBlock = hook.match(/if \(status === 'SUBSCRIBED'\) \{([\s\S]*?)\n      \}/)?.[1];
  assert.ok(subscribedBlock, 'Expected the Realtime subscription callback');
  assert.doesNotMatch(subscribedBlock, /synchronized = false/);
  assert.doesNotMatch(hook, /user_profile|author_name|email:/);
});

test('Community Home displays online count, loading, and unavailable states without total membership queries', async () => {
  const screen = await source('screens/CommunityScreen.tsx');

  assert.match(screen, /useCommunityPresence\(user\?\.id\)/);
  assert.match(screen, /member' : 'members'\}/);
  assert.match(screen, /Members online/);
  assert.match(screen, /Online count unavailable/);
  assert.match(screen, /\{hasUser \? \([\s\S]*?onlinePresence\.status/);
  assert.doesNotMatch(screen, /from\('user_profile'\)[\s\S]{0,100}count: 'exact'/);
});
