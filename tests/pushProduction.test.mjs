import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createOneSignalAuthLifecycle } from '../lib/oneSignalAuthLifecycle.js';

const root = new URL('../', import.meta.url);

test('iOS push uses production APNs configuration', async () => {
  const appConfig = JSON.parse(await readFile(new URL('app.json', root), 'utf8'));
  const plugin = appConfig.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'onesignal-expo-plugin');

  assert.equal(appConfig.expo.ios.entitlements['aps-environment'], 'production');
  assert.equal(plugin?.[1]?.mode, 'production');
});

test('notification taps route every supported destination natively', async () => {
  // Routes moved from pushNotifications.ts into the shared resolver; verify the resolver itself.
  const router = await readFile(new URL('lib/pushNotifications.ts', root), 'utf8');
  assert.ok(router.includes("import { resolveNotificationDestination } from './notificationDestinations';"));
  assert.ok(router.includes('if(target.params) navigate(target.route,target.params); else navigate(target.route);'));

  const compiled = ts.transpileModule(await readFile(new URL('lib/notificationDestinations.ts', root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const mocks = {
    './weeklyReport': { isReportWeek: (value) => value === '2026-11-09' },
    './deepLinks': { isValidCommunityPostId: (value) => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value) },
  };
  new vm.Script(`(function (exports, require, module) { ${compiled}
})`)
    .runInContext(vm.createContext({ module, exports: module.exports }))(module.exports, (name) => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
      return mocks[name];
    }, module);
  const resolve = module.exports.resolveNotificationDestination;
  const postId = '9f34c5ab-14e9-4bb0-8c2a-1e787fdf265e';

  assert.equal(resolve({ type: 'community_reply', post_id: postId }).route, 'CommunityPostThread');
  assert.equal(resolve({ type: 'co_parent_event_added' }).route, 'SharedCalendar');
  for (const [link, screen] of [['/', 'Home'], ['/bond', 'Bond'], ['/fitness', 'Fit'], ['/mind', 'Mind'], ['/community', 'Squad']]) {
    const target = resolve({ link });
    assert.equal(target.route, 'Tabs', `Missing native route for ${link}`);
    assert.equal(target.params.screen, screen, `Missing native route for ${link}`);
  }
  for (const link of ['/score', '/progress']) {
    assert.deepEqual({ ...resolve({ link }).params.params }, { openScoreDetail: true }, link);
  }
  assert.deepEqual({ ...resolve({ type: 'score' }).params.params }, { openScoreDetail: true });
});

test('Expo web never initializes the native OneSignal bridge', async () => {
  const router = await readFile(new URL('lib/pushNotifications.ts', root), 'utf8');

  assert.match(router, /Platform\.OS === 'web'/);
  assert.ok(
    router.indexOf("Platform.OS === 'web'") < router.indexOf("TurboModuleRegistry.get('OneSignal')"),
  );
});

function createPushCallRecorder() {
  const calls = [];
  const lifecycle = createOneSignalAuthLifecycle(
    (userId) => calls.push({ method: 'login', userId }),
    () => calls.push({ method: 'logout' }),
  );
  return { calls, lifecycle };
}

test('OneSignal auth lifecycle does not log out during cold or signed-out startup', () => {
  const { calls, lifecycle } = createPushCallRecorder();

  lifecycle.update(true, null);
  lifecycle.update(false, null);

  assert.deepEqual(calls, []);
});

test('OneSignal auth lifecycle logs in once after session restoration settles', () => {
  const { calls, lifecycle } = createPushCallRecorder();

  lifecycle.update(true, null);
  lifecycle.update(true, 'restored-user');
  lifecycle.update(false, 'restored-user');

  assert.deepEqual(calls, [{ method: 'login', userId: 'restored-user' }]);
});

test('OneSignal auth lifecycle logs out exactly once after a real sign-out', () => {
  const { calls, lifecycle } = createPushCallRecorder();

  lifecycle.update(false, 'signed-in-user');
  lifecycle.update(false, null);
  lifecycle.update(false, null);

  assert.deepEqual(calls, [
    { method: 'login', userId: 'signed-in-user' },
    { method: 'logout' },
  ]);
});

test('OneSignal auth lifecycle ignores repeated renders for the same user', () => {
  const { calls, lifecycle } = createPushCallRecorder();

  lifecycle.update(false, 'same-user');
  lifecycle.update(false, 'same-user');
  lifecycle.update(false, 'same-user');

  assert.deepEqual(calls, [{ method: 'login', userId: 'same-user' }]);
});

test('OneSignal auth lifecycle handles account switches and loading transitions', () => {
  const { calls, lifecycle } = createPushCallRecorder();

  lifecycle.update(false, 'account-a');
  lifecycle.update(true, null);
  lifecycle.update(true, 'account-b');
  lifecycle.update(false, 'account-b');
  lifecycle.update(false, 'account-b');
  lifecycle.update(false, null);
  lifecycle.update(false, null);

  assert.deepEqual(calls, [
    { method: 'login', userId: 'account-a' },
    { method: 'login', userId: 'account-b' },
    { method: 'logout' },
  ]);
});

test('OneSignal manager uses the tested lifecycle helper and keeps initialization', async () => {
  const [manager, auth] = await Promise.all([
    readFile(new URL('components/OneSignalManager.tsx', root), 'utf8'),
    readFile(new URL('contexts/AuthContext.tsx', root), 'utf8'),
  ]);

  assert.match(manager, /createOneSignalAuthLifecycle\(loginPushUser, logoutPushUser\)/);
  assert.match(manager, /initializePushNotifications\(\)/);
  assert.doesNotMatch(auth, /logoutPushUser/);
  assert.match(auth, /await supabase\.auth\.signOut\(\)/);
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
