import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('iOS push uses production APNs configuration', async () => {
  const appConfig = JSON.parse(await readFile(new URL('app.json', root), 'utf8'));
  const plugin = appConfig.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'onesignal-expo-plugin');

  assert.equal(appConfig.expo.ios.entitlements['aps-environment'], 'production');
  assert.equal(plugin?.[1]?.mode, 'production');
});

test('notification taps route every supported destination natively', async () => {
  const router = await readFile(new URL('lib/pushNotifications.ts', root), 'utf8');

  for (const destination of [
    "navigate('CommunityPostThread'",
    "navigate('SharedCalendar'",
    "navigate('Progress'",
    "screen: 'Home'",
    "screen: 'Bond'",
    "screen: 'Fit'",
    "screen: 'Mind'",
    "screen: 'Squad'",
  ]) {
    assert.ok(router.includes(destination), `Missing native route: ${destination}`);
  }
});

test('Present Dad completion is no longer written by the mobile client', async () => {
  const hook = await readFile(new URL('hooks/usePresentDadMode.ts', root), 'utf8');

  assert.doesNotMatch(hook, /status:\s*'completed'/);
  assert.doesNotMatch(hook, /completed_at/);
  assert.match(hook, /ends_at/);
});
