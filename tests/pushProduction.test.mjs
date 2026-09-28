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
    "screen: 'Home'",
    "screen: 'Bond'",
    "screen: 'Fit'",
    "screen: 'Mind'",
    "screen: 'Squad'",
  ]) {
    assert.ok(router.includes(destination), `Missing native route: ${destination}`);
  }
  assert.ok(router.includes("params: { openScoreDetail: true }"));
});

test('Expo web never initializes the native OneSignal bridge', async () => {
  const router = await readFile(new URL('lib/pushNotifications.ts', root), 'utf8');

  assert.match(router, /Platform\.OS === 'web'/);
  assert.ok(
    router.indexOf("Platform.OS === 'web'") < router.indexOf("TurboModuleRegistry.get('OneSignal')"),
  );
});

test('Present Dad completion is requested through the server RPC, not a direct row update', async () => {
  const hook = await readFile(new URL('hooks/usePresentDadMode.ts', root), 'utf8');

  assert.match(hook, /supabase\.rpc\('finish_present_dad_session'/);
  assert.doesNotMatch(hook, /from\('present_dad_sessions'\)\.update/);
  assert.match(hook, /completed_at/);
  assert.match(hook, /ends_at/);
});

test('Present Dad resumes active sessions and delegates duplicate prevention to the server constraint', async () => {
  const [hook, screen, experience, migration] = await Promise.all([
    readFile(new URL('hooks/usePresentDadMode.ts', root), 'utf8'),
    readFile(new URL('screens/BondScreen.tsx', root), 'utf8'),
    readFile(new URL('components/bond/PresentDadMode.tsx', root), 'utf8'),
    readFile(new URL('../dadHealth/supabase/migrations/20260928150000_change08_present_dad_and_circle_descriptions.sql', root), 'utf8'),
  ]);

  assert.match(hook, /\.eq\('status', 'active'\)/);
  assert.match(experience, /if \(existing\?\.status === 'active'\)/);
  assert.match(experience, /setPhase\('timer'\)/);
  assert.match(screen, /<PresentDadMode/);
  assert.match(migration, /idx_present_dad_one_active_per_user/);
});
