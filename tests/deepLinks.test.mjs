import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const deepLinksSource = readFileSync(new URL('lib/deepLinks.ts', root), 'utf8');
const ownerStorageSource = readFileSync(new URL('lib/accountPrivacyCleanup.ts', root), 'utf8');

/** The real owner-scoped secure storage helpers, backed by the test's in-memory stores. */
function loadOwnerStorage(secureStore, asyncStorage) {
  const compiled = ts.transpileModule(ownerStorageSource, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: 'accountPrivacyCleanup.ts',
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({ JSON, Promise, module, exports: module.exports });
  const mocks = {
    'expo-secure-store': secureStore,
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => asyncStorage.get(key) ?? null,
      setItem: async (key, value) => { asyncStorage.set(key, value); },
    },
    // Cleanup-only dependencies; the owner read/write helpers never call them.
    './offlineSync': { pauseAndClearOfflineUser: async () => {} },
    './biometric': { clearOwnerBiometricCredentials: async () => {} },
    './analytics': { clearAnalyticsOwner: async () => {} },
  };
  new vm.Script(`(function (exports, require, module) { ${compiled}
})`)
    .runInContext(context)(module.exports, (specifier) => {
      if (!(specifier in mocks)) throw new Error(`Unexpected import: ${specifier}`);
      return mocks[specifier];
    }, module);
  return module.exports;
}

function loadDeepLinks(initialUrl = null, sessionUserId = null) {
  const storage = new Map();
  const asyncStorage = new Map();
  let urlListener = null;
  const secureStore = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
    getItemAsync: async (key) => storage.get(key) ?? null,
    setItemAsync: async (key, value) => storage.set(key, value),
    deleteItemAsync: async (key) => storage.delete(key),
  };
  const ownerStorage = loadOwnerStorage(secureStore, asyncStorage);
  const compiled = ts.transpileModule(deepLinksSource, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'deepLinks.ts',
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({
    URLSearchParams,
    JSON,
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === 'expo-secure-store') return secureStore;
      if (specifier === './accountPrivacyCleanup') return ownerStorage;
      if (specifier === './supabase') {
        // Signed out by default: links captured before sign-in stay in memory until an owner exists.
        return { supabase: { auth: { getSession: async () => ({ data: { session: sessionUserId ? { user: { id: sessionUserId } } : null } }) } } };
      }
      if (specifier === '@react-navigation/native') {
        return { getStateFromPath: (path) => ({ path }) };
      }
      if (specifier === 'react-native') {
        return {
          Linking: {
            getInitialURL: async () => initialUrl,
            addEventListener: (_event, listener) => {
              urlListener = listener;
              return { remove() { urlListener = null; } };
            },
          },
        };
      }
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });

  new vm.Script(`(function (exports, require, module) { ${compiled}\n})`)
    .runInContext(context)(module.exports, context.require, module);
  return {
    deepLinks: module.exports,
    storage,
    emitUrl(url) {
      urlListener?.({ url });
    },
  };
}

/** The real notification destination resolver, with its two pure dependencies stubbed faithfully. */
function loadResolver() {
  const compiled = ts.transpileModule(readFileSync(new URL('lib/notificationDestinations.ts', root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const uuid = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
  const mocks = {
    './weeklyReport': { isReportWeek: (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && new Date(`${value}T00:00:00Z`).getUTCDay() === 1 },
    './deepLinks': { isValidCommunityPostId: (value) => typeof value === 'string' && uuid.test(value) },
  };
  new vm.Script(`(function (exports, require, module) { ${compiled}\n})`)
    .runInContext(vm.createContext({ module, exports: module.exports }))(module.exports, (name) => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
      return mocks[name];
    }, module);
  return module.exports;
}

test('the custom-scheme contract accepts only supported, validated routes', () => {
  const { deepLinks } = loadDeepLinks();
  const token = 'header.payload.signature';
  const postId = '9f34c5ab-14e9-4bb0-8c2a-1e787fdf265e';

  assert.equal(deepLinks.deepLinkingOptions.getStateFromPath(`shared-calendar?token=${token}`).path, `shared-calendar?token=${token}`);
  assert.match(
    deepLinks.deepLinkingOptions.getStateFromPath('shared-calendar').path,
    /__invalid_co_parent_invite__/,
  );
  assert.equal(deepLinks.deepLinkingOptions.getStateFromPath(`community/${postId}`).path, `community/${postId}`);
  assert.equal(deepLinks.deepLinkingOptions.getStateFromPath('score').path, 'today?openScoreDetail=true');
  assert.equal(deepLinks.deepLinkingOptions.getStateFromPath('progress').path, 'today?openScoreDetail=true');
  assert.equal(deepLinks.deepLinkingOptions.getStateFromPath('community/not-a-uuid'), undefined);
  assert.equal(deepLinks.deepLinkingOptions.getStateFromPath('auth/callback?code=private'), undefined);
  assert.equal(deepLinks.deepLinkingOptions.getStateFromPath('unsupported/path'), undefined);
});

test('invite and community identifiers reject malformed or oversized values', () => {
  const { deepLinks } = loadDeepLinks();

  assert.equal(deepLinks.isValidCoParentInviteToken('header.payload.signature'), true);
  assert.equal(deepLinks.isValidCoParentInviteToken('not-a-jwt'), false);
  assert.equal(deepLinks.isValidCoParentInviteToken(`a.${'b'.repeat(4096)}.c`), false);
  assert.equal(deepLinks.isValidCommunityPostId('9f34c5ab-14e9-4bb0-8c2a-1e787fdf265e'), true);
  assert.equal(deepLinks.isValidCommunityPostId('9f34c5ab-14e9-4bb0-not-valid'), false);
});

test('cold and warm supported URLs are captured before navigation while unsupported paths are ignored', async () => {
  const coldToken = 'cold.payload.signature';
  const warmToken = 'warm.payload.signature';
  const { deepLinks, emitUrl } = loadDeepLinks(`dadhealth://shared-calendar?token=${coldToken}`);

  assert.equal(
    await deepLinks.deepLinkingOptions.getInitialURL(),
    `dadhealth://shared-calendar?token=${coldToken}`,
  );
  assert.equal((await deepLinks.readPendingCoParentInvite()).token, coldToken);

  const received = [];
  const unsubscribe = deepLinks.deepLinkingOptions.subscribe((url) => received.push(url));
  emitUrl('dadhealth://unsupported/path');
  emitUrl(`dadhealth://shared-calendar?token=${warmToken}`);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(received, [`dadhealth://shared-calendar?token=${warmToken}`]);
  assert.equal((await deepLinks.readPendingCoParentInvite()).token, warmToken);
  unsubscribe();
});

test('pending co-parent invites persist securely per account and clear only the expected token', async () => {
  const { deepLinks, storage } = loadDeepLinks();
  const token = 'first.payload.signature';

  // Before sign-in the invite is held in memory only, never written to secure storage.
  await deepLinks.persistPendingCoParentInvite(token);
  assert.equal((await deepLinks.readPendingCoParentInvite()).token, token);
  assert.equal([...storage.values()].some((value) => String(value).includes(token)), false);
  await deepLinks.clearPendingCoParentInvite('other.payload.signature');
  assert.equal((await deepLinks.readPendingCoParentInvite()).token, token);

  // The first signed-in owner receives it in secure storage; the memory copy is handed over.
  const pending = await deepLinks.readPendingCoParentInvite('user-one');
  assert.equal(pending.token, token);
  assert.equal(pending.blockedUserId, undefined);
  assert.equal(await deepLinks.readPendingCoParentInvite(), null);
  assert.equal(await deepLinks.readPendingCoParentInvite('user-two'), null, 'another account cannot read it');

  await deepLinks.blockPendingCoParentInviteForUser(token, 'user-one');
  const blocked = await deepLinks.readPendingCoParentInvite('user-one');
  assert.equal(blocked.token, token);
  assert.equal(blocked.blockedUserId, 'user-one');

  await deepLinks.clearPendingCoParentInvite('other.payload.signature', 'user-one');
  assert.equal((await deepLinks.readPendingCoParentInvite('user-one')).token, token);
  await deepLinks.clearPendingCoParentInvite(token, 'user-two');
  assert.equal((await deepLinks.readPendingCoParentInvite('user-one')).token, token, 'another account cannot clear it');
  await deepLinks.clearPendingCoParentInvite(token, 'user-one');
  assert.equal(await deepLinks.readPendingCoParentInvite('user-one'), null);
});

test('invite attempt locks prevent concurrent and completed duplicate acceptance', () => {
  const { deepLinks } = loadDeepLinks();
  const retryable = 'retryable.payload.signature';
  const completed = 'completed.payload.signature';

  assert.equal(deepLinks.beginCoParentInviteAttempt(retryable), true);
  assert.equal(deepLinks.beginCoParentInviteAttempt(retryable), false);
  deepLinks.finishCoParentInviteAttempt(retryable, false);
  assert.equal(deepLinks.beginCoParentInviteAttempt(retryable), true);
  deepLinks.finishCoParentInviteAttempt(retryable, false);

  assert.equal(deepLinks.beginCoParentInviteAttempt(completed), true);
  deepLinks.finishCoParentInviteAttempt(completed, true);
  assert.equal(deepLinks.beginCoParentInviteAttempt(completed), false);
});

test('the lifecycle manager waits for auth/onboarding and resumes after foreground or reconnect', () => {
  const app = readFileSync(new URL('App.js', root), 'utf8');
  const rootNavigator = readFileSync(new URL('contexts/RootNavigator.tsx', root), 'utf8');
  const manager = readFileSync(new URL('components/DeepLinkManager.tsx', root), 'utf8');

  assert.match(app, /linking=\{deepLinkingOptions\}/);
  assert.match(rootNavigator, /<DeepLinkManager navigationRef=\{navigationRef\} \/>/);
  assert.match(manager, /onboardingComplete !== true/);
  assert.match(manager, /Platform\.OS === 'web'/);
  assert.match(manager, /readPendingCoParentInvite\(user\.id\)/);
  assert.match(manager, /pending\.blockedUserId === user\.id/);
  assert.match(manager, /AppState\.addEventListener\('change'/);
  assert.match(manager, /previousOffline\.current && !isOffline/);
  assert.match(manager, /navigationRef\.addListener\('state'/);
});

test('Shared Calendar maps permanent and temporary invite outcomes without exposing backend errors', () => {
  const screen = readFileSync(
    new URL('screens/subscreens/SharedCalendarScreen.tsx', root),
    'utf8',
  );
  const deepLinks = readFileSync(new URL('lib/deepLinks.ts', root), 'utf8');
  const acceptInvite = screen.slice(
    screen.indexOf('const acceptInvite'),
    screen.indexOf('const ensureSchedule'),
  );

  assert.match(screen, /response\.status === 400/);
  assert.match(screen, /clearPendingCoParentInvite\(token, user\.id\)/);
  assert.match(screen, /response\.status === 403/);
  assert.match(screen, /blockPendingCoParentInviteForUser\(token, user\.id\)/);
  assert.match(screen, /We could not accept this calendar invite right now\. Check your connection and try again\./);
  assert.match(
    deepLinks,
    /This calendar invite is invalid or has expired\. Ask your co-parent to send a new invite\./,
  );
  assert.doesNotMatch(acceptInvite, /body\.error|throw new Error\(body/);
});

test('notification destinations remain pending through auth remounts and validate community IDs', () => {
  const push = readFileSync(new URL('lib/pushNotifications.ts', root), 'utf8');
  const destinations = readFileSync(new URL('lib/notificationDestinations.ts', root), 'utf8');

  assert.match(push, /pendingShownWhileSignedOut/);
  assert.match(push, /setPushNavigationLifecycleReady/);
  assert.match(push, /authenticatedDestinationReady/);
  // Push taps resolve through the shared resolver and navigate to its route.
  assert.match(push, /const target=resolveNotificationDestination\(data as Record<string,unknown>\);/);
  assert.match(push, /if\(target\.params\) navigate\(target\.route,target\.params\); else navigate\(target\.route\);/);
  assert.match(destinations, /isValidCommunityPostId\(data\.post_id\)/);

  const { resolveNotificationDestination: resolve } = loadResolver();
  const postId = '9f34c5ab-14e9-4bb0-8c2a-1e787fdf265e';
  assert.equal(resolve({ type: 'community_reply', post_id: postId }).route, 'CommunityPostThread');
  assert.equal(resolve({ type: 'community_like', post_id: postId }).params.postId, postId);
  assert.equal(resolve({ type: 'community_reply', post_id: 'not-a-uuid' }), null, 'community IDs are validated');
  assert.equal(resolve({ type: 'co_parent_event_added' }).route, 'SharedCalendar');
  for (const [link, screen] of [['/', 'Home'], ['/bond', 'Bond'], ['/fitness', 'Fit'], ['/mind', 'Mind'], ['/community', 'Squad']]) {
    const target = resolve({ link });
    assert.equal(target.route, 'Tabs', link);
    assert.equal(target.params.screen, screen, link);
  }
  assert.equal(resolve({ link: '/unknown' }), null);
});

test('Custom links do not add Universal Links or Android App Links', () => {
  const appConfig = readFileSync(new URL('app.json', root), 'utf8');
  assert.match(appConfig, /"scheme": "dadhealth"/);
  assert.doesNotMatch(appConfig, /associatedDomains|intentFilters|assetlinks|apple-app-site-association/);
});
