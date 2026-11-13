import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
} }).outputText;
function load(path, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(compile(read(path)), { exports, ...globals, require(name) {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name];
  } });
  return exports;
}
const monthly = 'co.uk.dadhealth.pro.monthly';
const annual = 'co.uk.dadhealth.pro.annual';
const free = { isPro: false, canPurchase: true, status: null, primaryProvider: null,
  activeProviders: [], plan: null, productId: null, currentPeriodEnd: null };
const pro = { ...free, isPro: true, canPurchase: false, status: 'active', primaryProvider: 'apple',
  activeProviders: ['apple'], plan: 'monthly', productId: monthly, currentPeriodEnd: '2027-01-01T00:00:00Z' };
const receipt = (id = 'transaction-1') => ({ id, productId: monthly, purchaseToken: 'mock-signed-transaction', purchaseState: 'purchased' });
const offer = (patch = {}) => ({ type: 'introductory', price: 0, paymentMode: 'free-trial', periodCount: 1,
  period: { unit: 'day', value: 7 }, ...patch });
const product = (id = monthly, group = 'group-a', intro = offer()) => ({ id, platform: 'ios', displayPrice: 'GBP 6.99',
  subscriptionGroupIdIOS: group, subscriptionOffers: intro ? [intro] : [] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setImmediate(resolve));

function serviceHarness() {
  const h = { owner: 'owner-a', requests: [], payload: free, ownership: 'standalone', opened: [], capability: async () => true };
  const linking = { canOpenURL: (...args) => h.capability(...args), openURL: async url => { h.opened.push(url); } };
  h.api = load('lib/nativeSubscriptions.ts', {
    'react-native': { Platform: { OS: 'ios' }, Linking: linking },
    'expo-constants': { default: { appOwnership: h.ownership } },
    './supabase': { supabase: { auth: { getSession: async () => ({ data: { session: {
      access_token: 'mock-token', user: { id: h.owner },
    } }, error: null }) } } },
  }, { process: { env: { EXPO_PUBLIC_APPLE_IAP_PRO_MONTHLY_PRODUCT_ID: monthly, EXPO_PUBLIC_APPLE_IAP_PRO_ANNUAL_PRODUCT_ID: annual } },
    fetch: async (...args) => { h.requests.push(args); return { ok: true, json: async () => h.payload }; } });
  return h;
}

function hookHarness(initial = {}) {
  const service = serviceHarness().api;
  const slots = [], effects = []; let cursor = 0, pending = [], owner = 'owner-a';
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(callback, deps) { const i = cursor++; if (!depsEqual(slots[i]?.deps, deps)) slots[i] = { value: callback, deps }; return slots[i].value; },
    useMemo(callback, deps) { const i = cursor++; if (!depsEqual(slots[i]?.deps, deps)) slots[i] = { value: callback(), deps }; return slots[i].value; },
    useEffect(callback, deps) { const i = cursor++; if (!depsEqual(effects[i]?.deps, deps)) pending.push(() => {
      effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: callback() };
    }); },
  };
  const h = { summary: free, checks: [], prepares: [], verifies: [], finishes: [], requests: [], changes: 0, catalogCalls: 0,
    supported: true, catalog: [product(), product(annual)], available: [], update: null, error: null, resume: null, ...initial };
  h.iap = {
    initConnection: async () => true, endConnection: async () => {},
    purchaseUpdatedListener(fn) { h.update = fn; return { remove() { if (h.update === fn) h.update = null; } }; },
    purchaseErrorListener(fn) { h.error = fn; return { remove() { if (h.error === fn) h.error = null; } }; },
    fetchProducts: async () => { h.catalogCalls++; return h.catalog; },
    isEligibleForIntroOfferIOS: async (group) => { h.checks.push(group); return true; },
    requestPurchase: async (request) => { h.requests.push(request); },
    getAvailablePurchases: async () => h.available,
    finishTransaction: async ({ purchase }) => { h.finishes.push(purchase.id); },
  };
  h.api = { ...service,
    getNativeIapModule: () => h.supported ? h.iap : null,
    loadNativeSubscriptionStatus: async () => h.summary,
    prepareNativePurchase: async (plan, account) => { h.prepares.push(account); return { provider: 'apple', productId: plan === 'monthly' ? monthly : annual, appAccountToken: account }; },
    verifyNativePurchase: async (purchase, account) => { h.verifies.push([purchase.id, account]); h.summary = pro; return h.summary; },
    openSubscriptionManagement: async () => {},
    loadNativeMembership: async () => [],
  };
  let now = 0, timerId = 0; const timers = new Map();
  h.advance = (ms) => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } };
  h.timers = timers;
  const module = load('hooks/useNativeSubscriptions.ts', { react,
    '../contexts/NetworkContext': { useNetworkStatus: () => ({ isOffline: Boolean(h.offline) }) },
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener(_, fn) { h.resume = fn; return { remove() {} }; } } },
    '../lib/nativeSubscriptions': h.api }, {
      setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; },
      clearTimeout(id) { timers.delete(id); },
    });
  const changed = () => { h.changes++; };
  h.render = () => { cursor = 0; pending = []; h.result = module.useNativeSubscriptions(owner, changed); pending.forEach((effect) => effect()); return h.result; };
  h.flush = async () => { await tick(); h.render(); await tick(); h.render(); };
  h.switch = (next) => { owner = next; h.render(); };
  h.unmount = () => { effects.forEach((effect) => effect?.cleanup?.()); };
  h.replayEffects = () => { h.unmount(); effects.length = 0; h.render(); };
  h.render(); return h;
}

for (const period of [{ unit: 'day', value: 7 }, { unit: 'week', value: 1 }]) {
  test(`seven-day trial accepts ${period.unit}:${period.value} and keeps store prices`, async () => {
    const api = serviceHarness().api;
    const [plan] = await api.resolveNativePlanEligibility([product(monthly, 'g', offer({ period }))], async () => true);
    assert.equal(plan.trialEligibility, 'eligible'); assert.equal(plan.displayPrice, 'GBP 6.99');
  });
}
for (const patch of [{ paymentMode: 'pay-up-front' }, { paymentMode: 'unknown' }, { paymentMode: undefined },
  { price: 1 }, { periodCount: 2 }, { periodCount: undefined }, { period: { unit: 'day', value: 3 } }, { period: { unit: 'week', value: 7 } }]) {
  test(`invalid introductory offer stays unknown: ${JSON.stringify(patch)}`, async () => {
    const [plan] = await serviceHarness().api.resolveNativePlanEligibility([product(monthly, 'g', offer(patch))], async () => true);
    assert.equal(plan.hasSevenDayTrial, false); assert.equal(plan.trialEligibility, 'unknown');
  });
}
test('eligibility uses each actual group; same group shares one lookup', async () => {
  const api = serviceHarness().api, calls = [];
  const plans = await api.resolveNativePlanEligibility([product(), product(annual, 'group-b')], async (g) => { calls.push(g); return g === 'group-a'; });
  assert.deepEqual(calls, ['group-a', 'group-b']);
  assert.equal(plans[0].trialEligibility, 'eligible'); assert.equal(plans[1].trialEligibility, 'ineligible');
  calls.length = 0;
  await api.resolveNativePlanEligibility([product(), product(annual)], async (g) => { calls.push(g); return true; });
  assert.equal(calls.length, 1);
});
test('missing group, missing offer and eligibility failure never promise a trial', async () => {
  const api = serviceHarness().api;
  for (const row of [product(monthly, ''), product(monthly, 'g', null), product()]) {
    const [plan] = await api.resolveNativePlanEligibility([row], async () => { throw Error('offline'); });
    assert.equal(plan.trialEligibility, 'unknown');
  }
});
test('account-bound API rejects a changed owner before dispatch', async () => {
  const h = serviceHarness(); h.owner = 'owner-b';
  await assert.rejects(h.api.prepareNativePurchase('monthly', 'owner-a'), /account changed/);
  assert.equal(h.requests.length, 0);
});
test('account-bound API rejects an account change during response parsing', async () => {
  const h = serviceHarness();
  h.payload = { then(resolve) { h.owner = 'owner-b'; resolve(free); } };
  await assert.rejects(h.api.loadNativeSubscriptionStatus('owner-a'), /account changed/);
});
test('malformed canonical responses and wrong preparation owners are rejected', async () => {
  const h = serviceHarness();
  for (const payload of [null, {}, { ...free, isPro: 'true' }, { ...free, activeProviders: ['unexpected'] }]) {
    h.payload = payload; await assert.rejects(h.api.loadNativeSubscriptionStatus('owner-a'), /could not confirm/);
  }
  h.payload = { provider: 'apple', productId: monthly, appAccountToken: 'owner-b' };
  await assert.rejects(h.api.prepareNativePurchase('monthly', 'owner-a'), /could not prepare/);
  h.payload = { ok: false, summary: pro };
  await assert.rejects(h.api.verifyNativePurchase(receipt(), 'owner-a'), /could not verify/);
  h.payload = { ok: true, summary: pro };
  assert.equal((await h.api.verifyNativePurchase(receipt(), 'owner-a')).isPro, true);
});
test('partial catalog blocks the missing plan; unknown eligibility blocks purchase', async () => {
  const h = hookHarness(); h.catalog = [product()]; await h.flush();
  await h.result.purchase('annual'); assert.equal(h.prepares.length, 0);
  h.iap.isEligibleForIntroOfferIOS = async () => { throw Error('offline'); };
  await h.result.retry(); await h.flush();
  await h.result.purchase('monthly'); assert.equal(h.prepares.length, 0); h.unmount();
});
test('catalog Retry recovers a failed fetch and rechecks eligibility', async () => {
  const h = hookHarness(); h.iap.fetchProducts = async () => { throw Error('offline'); }; await h.flush();
  assert.equal(h.result.storeAvailable, false); assert.equal(h.result.catalogLoading, false);
  h.iap.fetchProducts = async () => h.catalog;
  await h.result.retry(); await h.flush();
  assert.equal(h.result.storeAvailable, true); assert.equal(h.result.products[0].trialEligibility, 'eligible');
  assert.equal(h.result.error, null); h.unmount();
});
test('new catalog generation discards a late eligibility result', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.iap.isEligibleForIntroOfferIOS = () => gate.promise;
  const old = h.result.retry(); await tick();
  h.iap.isEligibleForIntroOfferIOS = async () => false;
  await h.result.retry(); gate.resolve(true); await old; await h.flush();
  assert.equal(h.result.products[0].trialEligibility, 'ineligible'); h.unmount();
});
test('rapid taps and restore overlap dispatch only one purchase', async () => {
  const h = hookHarness(); await h.flush();
  await Promise.all([h.result.purchase('monthly'), h.result.purchase('monthly'), h.result.restore()]);
  assert.equal(h.prepares.length, 1); assert.equal(h.requests.length, 1);
  h.error({ code: 'user-cancelled' }); await h.flush();
  assert.equal(h.result.purchasing, false); assert.equal(h.result.error, null); assert.equal(h.result.notice, 'Purchase cancelled.'); h.unmount();
});
test('duplicate callbacks verify and finish once; failed verification can retry', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.api.verifyNativePurchase = async (...args) => { h.verifies.push(args); return gate.promise; };
  h.update(receipt()); h.update(receipt()); await h.flush();
  assert.equal(h.verifies.length, 1); gate.resolve(pro); await h.flush();
  h.update(receipt()); await h.flush(); assert.equal(h.finishes.length, 1);
  h.api.verifyNativePurchase = async () => { throw Error('offline'); };
  h.update(receipt('retry')); await h.flush(); assert.match(h.result.error, /verify/);
  h.api.verifyNativePurchase = async () => pro;
  h.update(receipt('retry')); await h.flush(); assert.equal(h.finishes.length, 2); h.unmount();
});
test('pending then purchased clears pending copy; failure and cancellation clear opposing messages', async () => {
  const h = hookHarness(); await h.flush(); await h.result.purchase('monthly');
  h.update({ ...receipt(), purchaseState: 'pending' }); await h.flush();
  assert.equal(h.result.purchasing, false); assert.match(h.result.notice, /pending/);
  h.update(receipt()); await h.flush(); assert.equal(h.result.notice, 'Dad Health Pro is now active.');
  h.summary = free; await h.result.refreshStatus(); await h.flush(); await h.result.purchase('monthly');
  h.error({ code: 'network-error' }); await h.flush(); assert.equal(h.result.notice, null);
  await h.result.purchase('monthly'); h.error({ code: 'user-cancelled' }); await h.flush();
  assert.equal(h.result.error, null); h.unmount();
});
test('finish failure keeps canonical access and retries only finishing', async () => {
  const h = hookHarness(); await h.flush();
  h.iap.finishTransaction = async () => { throw Error('store unavailable'); };
  h.update(receipt()); await h.flush();
  assert.equal(h.result.status.isPro, true); assert.match(h.result.error, /store completion failed/);
  assert.equal(h.changes, 1); assert.equal(h.verifies.length, 1);
  h.available = [receipt()]; h.iap.finishTransaction = async ({ purchase }) => h.finishes.push(purchase.id);
  await h.result.restore(); await h.flush();
  assert.equal(h.verifies.length, 1); assert.equal(h.finishes.length, 1); assert.equal(h.result.error, null); h.unmount();
});
test('false canonical access and Stripe/manual-only access never claim an Apple success', async () => {
  for (const summary of [free, { ...pro, primaryProvider: 'stripe', activeProviders: ['stripe'] },
    { ...pro, primaryProvider: 'manual', activeProviders: [] }]) {
    const h = hookHarness(); await h.flush(); h.api.verifyNativePurchase = async () => summary;
    h.update(receipt()); await h.flush();
    assert.doesNotMatch(h.result.notice, /now active/); assert.equal(h.result.status.isPro, summary.isPro); h.unmount();
  }
});
test('empty restore refreshes canonical status without claiming restored access', async () => {
  const h = hookHarness(); await h.flush(); h.summary = pro;
  await h.result.restore(); await h.flush();
  assert.equal(h.result.status.isPro, true); assert.match(h.result.notice, /No active/); assert.equal(h.verifies.length, 0); h.unmount();
});
test('expired and missing-token restores are truthful; failures remain retryable', async () => {
  const h = hookHarness(); await h.flush(); h.available = [receipt()];
  h.api.verifyNativePurchase = async () => free;
  await h.result.restore(); await h.flush(); assert.match(h.result.notice, /No active/);
  h.available = [{ ...receipt('missing'), purchaseToken: null }];
  await h.result.restore(); await h.flush(); assert.equal(h.result.notice, null); assert.match(h.result.error, /could not be restored/);
  h.iap.getAvailablePurchases = async () => { throw Error('store offline'); };
  await h.result.restore(); await h.flush(); assert.equal(h.result.restoring, false); assert.match(h.result.error, /could not complete restore/); h.unmount();
});
test('partial restore keeps verified access, reports failures and continues after wrong-account item', async () => {
  const h = hookHarness(); await h.flush(); h.available = [receipt('wrong-account'), receipt('valid')];
  h.api.verifyNativePurchase = async (purchase) => {
    if (purchase.id === 'wrong-account') throw new h.api.NativeSubscriptionError('Another account owns this purchase.', 'already_linked');
    h.summary = pro; return pro;
  };
  await h.result.restore(); await h.flush();
  assert.equal(h.result.status.isPro, true); assert.equal(h.result.notice, null); assert.match(h.result.error, /access is confirmed, but restore is incomplete/);
  assert.deepEqual(h.finishes, ['valid']); h.unmount();
});
test('restore callback duplication and repeated restore taps do not duplicate verification', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.iap.getAvailablePurchases = () => gate.promise;
  const restore = h.result.restore(); void h.result.restore(); void h.result.purchase('monthly');
  h.update(receipt()); gate.resolve([receipt(), receipt()]); await restore; await h.flush();
  assert.equal(h.verifies.length, 1); assert.equal(h.finishes.length, 1); assert.equal(h.prepares.length, 0); h.unmount();
});
test('account switch during preparation prevents opening the old account purchase sheet', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.api.prepareNativePurchase = () => gate.promise;
  const work = h.result.purchase('monthly'); h.switch('owner-b'); await h.flush();
  gate.resolve({ provider: 'apple', productId: monthly, appAccountToken: 'owner-a' }); await work; await h.flush();
  assert.equal(h.requests.length, 0); assert.equal(h.result.purchasing, false); h.unmount();
});
test('account switch during verification discards result and does not finish unowned work', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.api.verifyNativePurchase = () => gate.promise; h.update(receipt());
  h.switch('owner-b'); await h.flush(); gate.resolve(pro); await h.flush();
  assert.equal(h.result.status.isPro, false); assert.equal(h.result.notice, null); assert.equal(h.finishes.length, 0); assert.equal(h.changes, 0); h.unmount();
});
test('account switch during restore lookup prevents verification under the new account', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.iap.getAvailablePurchases = () => gate.promise; const work = h.result.restore();
  h.switch('owner-b'); await h.flush(); gate.resolve([receipt()]); await work; await h.flush();
  assert.equal(h.verifies.length, 0); assert.equal(h.result.notice, null); h.unmount();
});
test('late catalog result after account change cannot publish old eligibility', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.iap.isEligibleForIntroOfferIOS = () => gate.promise; const work = h.result.retry(); await tick();
  h.iap.isEligibleForIntroOfferIOS = async () => false; h.switch('owner-b'); await h.flush();
  gate.resolve(true); await work; await h.flush(); assert.equal(h.result.products[0].trialEligibility, 'ineligible'); h.unmount();
});
test('unmount during verification suppresses all late finish/UI refresh work', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.api.verifyNativePurchase = () => gate.promise; h.update(receipt()); h.unmount(); gate.resolve(pro); await tick();
  assert.equal(h.finishes.length, 0); assert.equal(h.changes, 0);
});
test('same-account refresh retains canonical access; resume refreshes catalog eligibility', async () => {
  const h = hookHarness({ summary: pro }); await h.flush(); const gate = deferred();
  h.api.loadNativeSubscriptionStatus = () => gate.promise; const work = h.result.retry(); h.render();
  assert.equal(h.result.status.isPro, true); gate.reject(Error('offline')); await work; await h.flush();
  assert.equal(h.result.status.isPro, true); const count = h.catalogCalls;
  h.api.loadNativeSubscriptionStatus = async () => pro; await h.result.retry(); await h.flush();
  h.resume('background'); h.resume('active'); await h.flush();
  assert.ok(h.catalogCalls > count); h.unmount();
});
test('Expo Go keeps canonical access without loading store products', async () => {
  const h = hookHarness({ supported: false, summary: pro }); await h.flush();
  assert.equal(h.result.status.isPro, true); assert.equal(h.result.storeSupported, false);
  assert.equal(h.catalogCalls, 0); assert.equal(h.result.catalogLoading, false); h.unmount();
});

function screen(overrides = {}) {
  const actions = [], state = { status: free, products: [{ plan: 'annual', displayPrice: 'GBP 49.99', trialEligibility: 'eligible' }],
    loading: false, catalogLoading: false, statusLoading: false, storeAvailable: true, storeSupported: true,
    retry: () => actions.push('retry'), purchase: () => actions.push('purchase'), restore: () => actions.push('restore'), manage: () => actions.push('manage'), ...overrides };
  const react = { useEffect: () => {}, useCallback: (fn) => fn, useMemo: (fn) => fn(), useState: () => ['annual', () => {}],
    createElement: (type, props, ...children) => typeof type === 'function' ? type({ ...props, children }) : ({ type, props: props ?? {}, children }) };
  const mocks = { react: { ...react, default: react },
    'react-native': { Platform: { OS: 'ios' }, ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Feather: 'Icon', MaterialCommunityIcons: 'Icon' }, '@react-navigation/native': {
      useNavigation: () => ({ goBack: () => actions.push('back'), navigate: (route) => actions.push(route) }), useRoute: () => ({ params: { source: 'settings', context: overrides.context } }),
    }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../contexts/AuthContext': { useAuth: () => ({ user: { id: 'owner-a' } }) },
    '../../contexts/NetworkContext': { useNetworkStatus: () => ({ isOffline: Boolean(overrides.offline), dismissToast() {} }) },
    '../../hooks/useDashboard': { refreshDashboardForUser() {} },
    '../../hooks/useNativeSubscriptions': { useNativeSubscriptions: () => state },
    '../../theme': { colors: {} },
  };
  for (const name of ['AppTopBar', 'InlineFormError', 'LimeButton', 'mockup/ScreenHero', 'subscriptions/CancellationFlow']) mocks[`../../components/${name}`] = { __esModule: true, default: name };
  mocks['../../components/subscriptions/CancellationFlow'] = { __esModule: true, ...load('components/subscriptions/CancellationFlow.tsx', {
    react: { ...react, default: react }, 'react-native': mocks['react-native'], '@expo/vector-icons': mocks['@expo/vector-icons'],
    'react-native-safe-area-context': mocks['react-native-safe-area-context'], 'expo-crypto': { randomUUID: () => 'test' },
    '../../lib/nativeSubscriptions': {}, '../../theme': { colors: {} },
  }) };
  const module = load('screens/subscreens/ProSubscriptionScreen.tsx', mocks);
  const tree = module.default(), nodes = [];
  function visit(node) { if (Array.isArray(node)) node.forEach(visit); else if (node && typeof node === 'object') {
    nodes.push(node); visit(node.children); visit(node.props?.leftAccessory);
  } }
  visit(tree); return { nodes, text: JSON.stringify(tree), actions };
}
test('paywall renders trial/paid CTAs, blocks unknown/loading and wires Retry plus Back', () => {
  assert.match(screen().text, /Start 7-day free trial/);
  const paid = screen({ products: [{ plan: 'annual', displayPrice: 'GBP 49.99', trialEligibility: 'ineligible' }] });
  assert.match(paid.text, /Subscribe/); assert.doesNotMatch(paid.text, /Start 7-day/);
  const unknown = screen({ products: [{ plan: 'annual', displayPrice: 'GBP 49.99', trialEligibility: 'unknown' }] });
  assert.equal(unknown.nodes.filter((n) => n.type === 'Pressable' && ['Start 7-day free trial', 'Subscribe'].includes(n.props.accessibilityLabel)).length, 0);
  unknown.nodes.find((n) => n.type === 'Pressable' && JSON.stringify(n.children).includes('Retry')).props.onPress();
  unknown.nodes.find((n) => n.props?.accessibilityLabel === 'Close Dad Health Pro').props.onPress();
  assert.deepEqual(unknown.actions, ['retry', 'back']);
  const loading = screen({ catalogLoading: true }); assert.doesNotMatch(loading.text, /Start 7-day|Subscribe"/);
  assert.doesNotMatch(loading.text, /Checking subscription|"Retry"/);
  const unsupported = screen({ products: [], storeAvailable: false, storeSupported: false });
  assert.doesNotMatch(unsupported.text, />Retry|"Retry"/); assert.match(unsupported.text, /available on this device/);
});


test('late finish failure after account switch cannot overwrite the new account UI', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.iap.finishTransaction = () => gate.promise; h.update(receipt()); await h.flush();
  assert.equal(h.result.status.isPro, true);
  h.summary = free; h.switch('owner-b'); await h.flush(); const changes = h.changes;
  gate.reject(Error('late finish failure')); await h.flush();
  assert.equal(h.result.status.isPro, false); assert.equal(h.result.error, null);
  assert.equal(h.result.notice, null); assert.equal(h.changes, changes); h.unmount();
});
test('retrying an unfinished transaction cannot restore an obsolete cached Pro summary', async () => {
  const h = hookHarness(); await h.flush();
  h.iap.finishTransaction = async () => { throw Error('offline'); }; h.update(receipt()); await h.flush();
  h.summary = free; await h.result.refreshStatus(); await h.flush();
  h.available = [receipt()]; h.iap.finishTransaction = async () => {};
  await h.result.restore(); await h.flush();
  assert.equal(h.result.status.isPro, false); assert.match(h.result.notice, /No active/);
  assert.equal(h.verifies.length, 1); h.unmount();
});
test('pending queued callback does not strand a later purchased callback', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.api.verifyNativePurchase = async (purchase) => { h.verifies.push(purchase.id); return purchase.id === 'first' ? gate.promise : pro; };
  h.update(receipt('first')); h.update({ ...receipt('pending'), purchaseState: 'pending' }); h.update(receipt('last'));
  gate.resolve(pro); await h.flush();
  assert.deepEqual(h.finishes, ['first', 'last']); assert.equal(h.result.purchasing, false); h.unmount();
});
test('canonical refresh failure after restore preserves verified access without claiming restore completion', async () => {
  const h = hookHarness(); await h.flush(); h.available = [receipt()];
  h.api.loadNativeSubscriptionStatus = async () => { throw Error('offline'); };
  await h.result.restore(); await h.flush();
  assert.equal(h.result.status.isPro, true); assert.equal(h.result.notice, null);
  assert.match(h.result.error, /could not complete restore/); assert.equal(h.result.restoring, false); h.unmount();
});
test('unmount during catalog and restore discards late work', async () => {
  const h = hookHarness(); await h.flush(); const catalog = deferred(), store = deferred();
  h.iap.fetchProducts = () => catalog.promise; const refresh = h.result.retry();
  h.iap.getAvailablePurchases = () => store.promise; const restore = h.result.restore();
  await tick(); h.unmount(); catalog.resolve(h.catalog); store.resolve([receipt()]);
  await Promise.all([refresh, restore]); assert.equal(h.verifies.length, 0); assert.equal(h.changes, 0);
});
test('paid-only purchase uses the same backend preparation; preparation mismatch never opens Apple', async () => {
  const h = hookHarness(); await h.flush(); h.iap.isEligibleForIntroOfferIOS = async () => false;
  await h.result.retry(); await h.flush();
  await h.result.purchase('monthly'); assert.equal(h.requests.length, 1);
  h.error({ code: 'user-cancelled' }); await h.flush();
  h.api.prepareNativePurchase = async () => ({ provider: 'apple', productId: 'wrong-product', appAccountToken: 'owner-a' });
  await h.result.purchase('monthly'); await h.flush();
  assert.equal(h.requests.length, 1); assert.equal(h.result.purchasing, false); assert.ok(h.result.error); h.unmount();
});
test('unknown canonical access stays unknown after retry failure', async () => {
  const h = hookHarness(); await h.flush();
  h.api.loadNativeSubscriptionStatus = async () => { throw Error('offline'); };
  h.switch('owner-b'); await h.flush();
  assert.equal(h.result.status, null); assert.equal(h.result.loading, false);
  await h.result.purchase('monthly'); assert.equal(h.requests.length, 0);
  await h.result.retry(); await h.flush(); assert.equal(h.result.status, null); h.unmount();
});

test('effect cleanup/restart cannot revive an old verification result', async () => {
  const h = hookHarness(); await h.flush(); const gate = deferred();
  h.api.verifyNativePurchase = () => gate.promise;
  h.update(receipt()); h.replayEffects(); await h.flush();
  gate.resolve(pro); await h.flush();
  assert.equal(h.result.status.isPro, false); assert.equal(h.result.notice, null);
  assert.equal(h.finishes.length, 0); assert.equal(h.changes, 0); h.unmount();
});


test('settled request without an event releases busy state with neutral copy and no automatic retry', async () => {
  const h = hookHarness(); await h.flush(); await h.result.purchase('monthly'); await h.flush();
  assert.equal(h.result.purchasing, false); assert.equal(h.result.status.isPro, false);
  assert.equal(h.result.notice, 'Purchase confirmation has not arrived. Use Restore purchases to check.');
  assert.equal(h.requests.length, 1); assert.equal(h.verifies.length, 0);
  await h.result.restore(); await h.flush(); assert.match(h.result.notice, /No active/); h.unmount();
});
test('request settlement cannot release verification that a callback already owns', async () => {
  const h = hookHarness(); await h.flush(); const request = deferred(), verify = deferred();
  h.iap.requestPurchase = () => request.promise; h.api.verifyNativePurchase = () => verify.promise;
  const work = h.result.purchase('monthly'); await tick(); h.update(receipt());
  request.resolve(); await work; await h.flush();
  assert.equal(h.result.purchasing, true); assert.equal(h.result.notice, null);
  await h.result.restore(); assert.equal(h.finishes.length, 0);
  verify.resolve(pro); await h.flush(); assert.equal(h.result.purchasing, false);
  assert.equal(h.result.notice, 'Dad Health Pro is now active.'); h.unmount();
});
test('late purchased callback after normal settlement still verifies once', async () => {
  const h = hookHarness(); await h.flush(); await h.result.purchase('monthly'); await h.flush();
  h.update(receipt()); h.update(receipt()); await h.flush();
  assert.equal(h.verifies.length, 1); assert.equal(h.finishes.length, 1);
  assert.equal(h.result.notice, 'Dad Health Pro is now active.'); h.unmount();
});
test('pending and cancellation events before request settlement retain their outcomes', async () => {
  for (const outcome of ['pending', 'cancelled']) {
    const h = hookHarness(); await h.flush(); const request = deferred();
    h.iap.requestPurchase = () => request.promise;
    const work = h.result.purchase('monthly'); await tick();
    if (outcome === 'pending') h.update({ ...receipt(), purchaseState: 'pending' });
    else h.error({ code: 'user-cancelled' });
    request.resolve(); await work; await h.flush();
    assert.equal(h.result.purchasing, false);
    assert.match(h.result.notice, outcome === 'pending' ? /pending approval/ : /Purchase cancelled/);
    assert.doesNotMatch(h.result.notice, /confirmation has not arrived/); h.unmount();
  }
});
test('request rejection remains an error rather than neutral confirmation copy', async () => {
  const h = hookHarness(); await h.flush();
  h.iap.requestPurchase = async () => { throw { code: 'network-error' }; };
  await h.result.purchase('monthly'); await h.flush();
  assert.equal(h.result.purchasing, false); assert.equal(h.result.notice, null);
  assert.match(h.result.error, /store could not|store couldn/); h.unmount();
});
test('old request settlement cannot clear a new account operation', async () => {
  const h = hookHarness(); await h.flush(); const old = deferred(), current = deferred();
  h.iap.requestPurchase = () => old.promise;
  const previous = h.result.purchase('monthly'); await tick(); h.switch('owner-b'); await h.flush();
  h.iap.requestPurchase = () => current.promise;
  const next = h.result.purchase('monthly'); await tick(); old.resolve(); await previous; await h.flush();
  assert.equal(h.result.purchasing, true); assert.equal(h.result.notice, null);
  current.resolve(); await next; await h.flush(); assert.equal(h.result.purchasing, false); h.unmount();
});
test('unmount suppresses neutral confirmation from a late request settlement', async () => {
  const h = hookHarness(); await h.flush(); const request = deferred();
  h.iap.requestPurchase = () => request.promise;
  const work = h.result.purchase('monthly'); await tick(); h.unmount(); request.resolve(); await work; h.render();
  assert.equal(h.result.notice, null); assert.equal(h.changes, 0);
});
test('restore finish failure reports confirmed access only; successful retry reports restored', async () => {
  const h = hookHarness(); await h.flush(); h.available = [receipt()];
  h.iap.finishTransaction = async () => { throw Error('finish failed'); };
  await h.result.restore(); await h.flush();
  assert.equal(h.result.status.isPro, true); assert.equal(h.result.notice, null);
  assert.match(h.result.error, /access is confirmed, but store completion needs attention/);
  h.iap.finishTransaction = async ({ purchase }) => h.finishes.push(purchase.id);
  await h.result.restore(); await h.flush();
  assert.equal(h.verifies.length, 1); assert.equal(h.result.error, null);
  assert.equal(h.result.notice, 'Dad Health Pro has been restored.'); h.unmount();
});
test('finish failure with canonical false never claims confirmed Pro access', async () => {
  const h = hookHarness(); await h.flush(); h.available = [receipt()];
  h.api.verifyNativePurchase = async () => free;
  h.iap.finishTransaction = async () => { throw Error('finish failed'); };
  await h.result.restore(); await h.flush();
  assert.equal(h.result.status.isPro, false); assert.equal(h.result.notice, null);
  assert.match(h.result.error, /no active store subscription was confirmed/);
  assert.doesNotMatch(h.result.error, /Pro access is confirmed|has been restored/); h.unmount();
});


test('status failure never becomes a catalog failure, including Expo Go', async () => {
  for (const supported of [true, false]) {
    const h = hookHarness({ supported }); await h.flush();
    h.api.loadNativeSubscriptionStatus = async () => { throw Error('backend unavailable'); };
    await h.result.retry(); await h.flush();
    assert.match(h.result.statusError, /confirm/); assert.equal(h.result.catalogError, null);
    assert.equal(h.result.actionError, null); assert.equal(h.result.catalogLoading, false);
    h.unmount();
  }
});
test('catalog-only failure leaves canonical status intact and separate from action errors', async () => {
  const h = hookHarness(); await h.flush();
  h.iap.fetchProducts = async () => { throw Error('store unavailable'); };
  await h.result.retry(); await h.flush();
  assert.equal(h.result.statusError, null); assert.match(h.result.catalogError, /subscription options/);
  assert.equal(h.result.status.isPro, false);
  h.iap.getAvailablePurchases = async () => { throw Error('restore failed'); };
  await h.result.restore(); await h.flush(); assert.match(h.result.actionError, /complete restore/);
  h.iap.fetchProducts = async () => h.catalog;
  await h.result.retry(); await h.flush(); assert.equal(h.result.catalogError, null);
  assert.match(h.result.actionError, /complete restore/); h.unmount();
});
test('offline to online keeps failure until explicit Retry and holds progress until settlement', async () => {
  const h = hookHarness({ summary: pro }); await h.flush();
  h.offline = true; h.render(); await h.result.retry(); await h.flush();
  assert.match(h.result.statusError, /offline/); assert.equal(h.result.status.isPro, true);
  h.offline = false; h.render(); h.resume('background'); h.resume('active'); await h.flush();
  assert.match(h.result.statusError, /offline/);
  const gate = deferred(); h.api.loadNativeSubscriptionStatus = () => gate.promise;
  const retry = h.result.retry(); h.render();
  assert.equal(h.result.statusError, null); assert.equal(h.result.statusLoading, true);
  assert.equal(h.result.status.isPro, true);
  gate.reject(Error('still unavailable')); await retry; await h.flush();
  assert.equal(h.result.statusLoading, false); assert.match(h.result.statusError, /confirm/);
  await h.flush(); assert.match(h.result.statusError, /confirm/);
  h.api.loadNativeSubscriptionStatus = async () => pro;
  await h.result.retry(); await h.flush(); assert.equal(h.result.statusError, null); h.unmount();
});
test('Pro rendering has one error, one heading and stable retry/offline presentation', () => {
  const heading = screen({ context: 'Dad Health Pro' });
  assert.equal(heading.nodes.filter((n) => n.type === 'Text' && n.children.includes('Dad Health Pro')).length, 0);
  assert.equal(heading.nodes.filter((n) => n.type === 'Text' && n.children.includes('DAD HEALTH PRO')).length, 1);
  const unknown = screen({ status: null, statusError: 'Status failed', catalogError: 'Catalog failed' });
  assert.equal(unknown.nodes.filter((n) => n.type === 'InlineFormError' && n.props.message).length, 1);
  assert.match(unknown.text, /Status failed/); assert.doesNotMatch(unknown.text, /Catalog failed/);
  const busy = screen({ status: null, statusLoading: true, catalogLoading: true });
  assert.equal(busy.nodes.filter((n) => n.type === 'InlineFormError' && n.props.message).length, 0);
  assert.match(busy.text, /Checking your subscription/);
  const proRetry = screen({ status: pro, statusLoading: true, catalogLoading: true });
  assert.match(proRetry.text, /Everything is unlocked/);
  assert.doesNotMatch(proRetry.text, /Checking subscription|"Retry"/);
  assert.equal(proRetry.nodes.filter((n) => n.type === 'InlineFormError' && n.props.message).length, 0);
  const offline = screen({ offline: true, status: null, statusError: 'Status failed' });
  assert.match(offline.text, /You are offline/);
  assert.equal(offline.nodes.find((n) => n.type === 'Pressable' && JSON.stringify(n.children).includes('Retry')).props.disabled, true);
  const action = screen({ statusError: 'Status failed', actionError: 'Restore incomplete', notice: 'Old success' });
  assert.match(action.text, /Restore incomplete/); assert.doesNotMatch(action.text, /Status failed|Old success/);
});


test('membership optional metadata cannot erase verified canonical Pro access', async()=>{
 const h=serviceHarness();h.payload={isPro:true,canPurchase:false,activeProviders:['apple'],plan:'invalid',primaryProvider:'unknown'};
 const status=await h.api.loadNativeSubscriptionStatus('owner-a');assert.equal(status.isPro,true);assert.equal(status.plan,null);assert.equal(status.primaryProvider,null);assert.equal(status.currentPeriodEnd,null);
});
for(const [provider,plan] of [['apple','monthly'],['stripe','annual']]) test(`membership renders verified ${provider} ${plan} details`,()=>{
 const h=screen({status:{...pro,primaryProvider:provider,plan}});
 assert.match(h.text,/Membership/);assert.match(h.text,/Pro active/);assert.match(h.text,new RegExp(plan==='monthly'?'Monthly':'Annual'));assert.match(h.text,/Current period ends/);
 assert.equal(h.nodes.filter(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Manage subscription').length,1);
 assert.ok(h.nodes.some(n=>n.props.accessibilityLabel==='Close Dad Health Pro'));assert.doesNotMatch(h.text,/Renews on|Next payment|Cancellation date/);
});
test('manual, trial, overlap and missing billing information use truthful membership wording',()=>{
 const manual=screen({status:{...pro,primaryProvider:'manual',plan:null,currentPeriodEnd:null,activeProviders:[]}});
 assert.match(manual.text,/Pro access provided by Dad Health/);assert.doesNotMatch(manual.text,/Manage subscription|Billed through|Current period ends/);
 assert.match(screen({status:{...pro,status:'trialing'}}).text,/Pro trial/);
 assert.match(screen({status:{...pro,activeProviders:['apple','stripe']}}).text,/Another active subscription may exist/);
 const unknown=screen({status:{...pro,primaryProvider:null,plan:'invalid',currentPeriodEnd:'invalid'}});
 assert.match(unknown.text,/Everything is unlocked/);assert.doesNotMatch(unknown.text,/Manage subscription|Billed through|Current period ends|invalid/);
});
test('Free and expired preserve paywall; missing access never becomes Free',()=>{
 for(const status of [free,{...free,status:'expired'}]) {const h=screen({status});assert.match(h.text,/Start 7-day free trial/);assert.ok(h.nodes.some(n=>n.props.accessibilityLabel==='Close Dad Health Pro'));assert.doesNotMatch(h.text,/Membership/);}
 const unknown=screen({status:null,statusError:'Could not verify access',products:[]});assert.doesNotMatch(unknown.text,/Start 7-day free trial|Everything is unlocked/);assert.match(unknown.text,/Could not verify access/);
 assert.match(screen({status:null,loading:true}).text,/Checking your subscription/);
 assert.match(screen({status:pro,offline:true,statusError:'Offline'}).text,/Everything is unlocked/);
});
test('management repeated taps are excluded and matching lock releases after failure',async()=>{
 const h=hookHarness({summary:pro});await h.flush();const gate=deferred();let calls=0;
 h.api.openSubscriptionManagement=async(owner,valid)=>{calls++;assert.equal(owner,'owner-a');assert.equal(valid(),true);await gate.promise;};
 const work=h.result.manage();h.render();assert.equal(h.result.managing,true);await h.result.manage();assert.equal(calls,1);
 gate.reject(Error('offline'));await work;h.render();assert.equal(h.result.managing,false);assert.match(h.result.error,/open subscription management/);
 h.api.openSubscriptionManagement=async()=>{calls++;};await h.result.manage();h.render();assert.equal(calls,2);assert.equal(h.result.managing,false);h.unmount();
});
for(const mode of ['switch','unmount'])test(`management ignores late failure after ${mode}`,async()=>{
 const h=hookHarness({summary:pro});await h.flush();const gate=deferred();let valid;
 h.api.openSubscriptionManagement=async(owner,check)=>{valid=check;await gate.promise;};const work=h.result.manage();
 if(mode==='switch'){h.switch('owner-b');await h.flush();}else h.unmount();
 assert.equal(valid(),false);gate.reject(Error('late management failure'));await work;
 if(mode==='switch'){h.render();assert.equal(h.result.error,null);assert.equal(h.result.managing,false);h.unmount();}
});
test('management is blocked during a purchase operation',async()=>{
 const h=hookHarness();await h.flush();const gate=deferred();let manages=0;h.iap.requestPurchase=()=>gate.promise;h.api.openSubscriptionManagement=async()=>manages++;
 const purchase=h.result.purchase('monthly');await tick();await h.result.manage();assert.equal(manages,0);gate.resolve();await purchase;h.unmount();
});
for(const url of ['https://apps.apple.com/account/subscriptions','https://billing.stripe.com/p/session/mock'])test(`management opens unchanged provider URL: ${url}`,async()=>{
 const h=serviceHarness();h.payload={url};await h.api.openSubscriptionManagement('owner-a',()=>true);assert.deepEqual(h.opened,[url]);assert.match(h.requests[0][0],/native-subscriptions\/manage$/);
});
test('management does not open URL after account switch during HTTP',async()=>{
 const h=serviceHarness();h.payload={then(resolve){h.owner='owner-b';resolve({url:'https://apps.apple.com/account/subscriptions'});}};
 await assert.rejects(h.api.openSubscriptionManagement('owner-a',()=>true),/account changed/);assert.equal(h.opened.length,0);
});
for(const mode of ['switch','unmount'])test(`management checks ${mode} after URL capability check`,async()=>{
 const h=serviceHarness();h.payload={url:'https://apps.apple.com/account/subscriptions'};let live=true;
 h.capability=async()=>{if(mode==='switch')h.owner='owner-b';else live=false;return true;};
 await assert.rejects(h.api.openSubscriptionManagement('owner-a',()=>live),/account changed/);assert.equal(h.opened.length,0);
});
test('membership Manage button reflects progress without a second action',()=>{
 const h=screen({status:pro,managing:true});const buttons=h.nodes.filter(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Manage subscription');assert.equal(buttons.length,1);assert.equal(buttons[0].props.accessibilityState.busy,true);assert.equal(buttons[0].props.disabled,true);
});

test('invalid and missing period-end dates are omitted, not normalised into billing dates',()=>{
 for(const date of [null,undefined,'invalid','123','2027-02-30T00:00:00Z']) assert.doesNotMatch(screen({status:{...pro,currentPeriodEnd:date}}).text,/Current period ends/);
});
test('unsupported URL and offline management settle safely without opening a provider',async()=>{
 const service=serviceHarness();service.payload={url:'https://apps.apple.com/account/subscriptions'};service.capability=async()=>false;
 await assert.rejects(service.api.openSubscriptionManagement('owner-a',()=>true),/open subscription management/);assert.equal(service.opened.length,0);
 const h=hookHarness({summary:pro,offline:true});await h.flush();let calls=0;h.api.openSubscriptionManagement=async()=>calls++;await h.result.manage();h.render();assert.equal(calls,0);assert.equal(h.result.managing,false);h.unmount();
});


for (const action of ['purchase', 'restore']) test(`pending management blocks ${action} before rerender and releases afterwards`, async () => {
  const h = hookHarness(); await h.flush();
  const gate = deferred(); let restoreCalls = 0;
  h.api.openSubscriptionManagement = () => gate.promise;
  h.iap.getAvailablePurchases = async () => { restoreCalls++; return []; };
  const managing = h.result.manage();
  // Intentionally use the old render: exclusion must be synchronous.
  await h.result.purchase('monthly'); await h.result.restore();
  assert.equal(h.prepares.length, 0); assert.equal(h.requests.length, 0); assert.equal(restoreCalls, 0);
  gate.resolve(); await managing;
  if (action === 'purchase') {
    await h.result.purchase('monthly'); assert.equal(h.prepares.length, 1); assert.equal(h.requests.length, 1);
  } else {
    await h.result.restore(); assert.equal(restoreCalls, 1);
  }
  h.unmount();
});

test('period-end display uses UTC across device timezones and midnight boundaries', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Europe/London', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = zone;
      for (const [timestamp, expected] of [
        ['2027-01-01T00:30:00Z', '1 January 2027'],
        ['2027-07-01T23:30:00Z', '1 July 2027'],
        ['2027-07-02T00:30:00+01:00', '1 July 2027'],
        ['2026-12-31T23:30:00-08:00', '1 January 2027'],
      ]) {
        const rendered = screen({ status: { ...pro, currentPeriodEnd: timestamp } });
        assert.ok(rendered.text.includes(expected), `${zone}: ${timestamp}`);
        assert.match(rendered.text, /Current period ends/);
      }
      for (const timestamp of ['invalid', '2027-02-30T00:00:00Z']) {
        assert.doesNotMatch(screen({ status: { ...pro, currentPeriodEnd: timestamp } }).text, /Current period ends/);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});


test('unified paywall keeps crown, checklist before plans, store prices and right-side radios', () => {
  const h = screen({ products: [
    { plan: 'annual', displayPrice: 'CAD 81.23', trialEligibility: 'eligible' },
    { plan: 'monthly', displayPrice: 'CAD 9.87', trialEligibility: 'ineligible' },
  ] });
  assert.equal(h.nodes.filter(n => n.type === 'Icon' && n.props.name === 'crown').length, 1);
  const title = h.nodes.findIndex(n => n.type === 'Text' && n.children.includes('Unlock the\nfull experience'));
  const benefit = h.nodes.findIndex(n => n.type === 'Text' && n.children.includes('Understand what is shaping your Mind, Body and Bond scores'));
  const radios = h.nodes.filter(n => n.props.accessibilityRole === 'radio');
  assert.equal(radios.length, 2);
  assert.ok(title < benefit && benefit < h.nodes.indexOf(radios[0]));
  assert.match(JSON.stringify(radios[0].children[0]), /Annual|CAD 81.23/);
  assert.match(JSON.stringify(radios[1].children[0]), /CAD 9.87/);
  for (const radio of radios) assert.match(radio.children[1].props.className, /rounded-full/);
  assert.equal(radios[0].props.accessibilityState.checked, true);
  assert.doesNotMatch(h.text, /Save 28|59.99|Guided mind|Early access/);
  h.nodes.find(n => n.props.accessibilityLabel === 'Start 7-day free trial').props.onPress();
  assert.deepEqual(h.actions, ['purchase']);
});

test('unified paid, trial and manual cards use verified rows and outlined management', () => {
  for (const status of [pro, { ...pro, status: 'trialing' }, { ...pro, primaryProvider: 'manual' }]) {
    const h = screen({ status });
    assert.equal(h.nodes.filter(n => n.type === 'Icon' && n.props.name === 'crown').length, 1);
    assert.ok(h.nodes.some(n => n.type === 'Text' && n.children.includes(status.status === 'trialing' ? 'Pro Trial' : 'Pro is Active')));
    const manage = h.nodes.filter(n => n.props.accessibilityLabel === 'Manage subscription');
    if (status.primaryProvider === 'manual') {
      assert.equal(manage.length, 0);
      assert.match(h.text, /Access type/);
      assert.doesNotMatch(h.text, /Current period ends|Billed through|Annual|Monthly/);
    } else {
      assert.equal(manage.length, 1);
      assert.match(manage[0].props.className, /border-white/);
      manage[0].props.onPress(); assert.deepEqual(h.actions, ['manage']);
      assert.match(h.text, /Current period ends/);
    }
    assert.doesNotMatch(h.text, /Renews on|Trial ends|won.t be charged|Start 7-day/);
  }
});

test('compact footer preserves restore and existing policy destination; chevron is sole exit', () => {
  for (const status of [free, pro, { ...pro, status: 'trialing' }, { ...pro, primaryProvider: 'manual' }, null]) {
    const h = screen({ status });
    const close = h.nodes.filter(n => n.props.accessibilityLabel === 'Close Dad Health Pro');
    assert.equal(close.length, 1);
    assert.ok(!h.nodes.some(n => n.type === 'Text' && n.children.some(c => c === 'Back' || c === 'Not now')));
    close[0].props.onPress(); assert.deepEqual(h.actions, ['back']);
    const links = h.nodes.filter(n => n.props.accessibilityRole === 'link');
    assert.equal(links.length, 2);
    links.forEach(n => n.props.onPress());
    assert.deepEqual(h.actions, ['back', 'TermsPrivacy', 'TermsPrivacy']);
  }
  const h = screen();
  h.nodes.find(n => n.type === 'Pressable' && JSON.stringify(n.children).includes('Restore purchases')).props.onPress();
  assert.deepEqual(h.actions, ['restore']);
});


test('Expo Go restore error shown in the screenshot clears after ten seconds', async () => {
  const h = hookHarness({ supported: false }); await h.flush();
  await h.result.restore(); await h.flush();
  assert.equal(h.result.actionError, 'Purchases can only be restored from the Dad Health app installed through the store.');
  assert.equal(h.timers.size, 1);
  h.advance(9999); h.render(); assert.ok(h.result.actionError);
  h.advance(1); h.render();
  assert.equal(h.result.actionError, null);
  assert.equal(h.result.error, null);
  assert.equal(h.result.status.isPro, false);
  h.unmount();
});

test('action errors clear at ten seconds without clearing status or catalog failures', async () => {
  const h = hookHarness(); await h.flush();
  h.api.loadNativeSubscriptionStatus = async () => { throw Error('status failed'); };
  await h.result.refreshStatus().catch(() => {}); await h.flush();
  h.iap.getAvailablePurchases = async () => { throw Error('restore failed'); };
  await h.result.restore(); await h.flush();
  const statusError = h.result.statusError;
  assert.ok(h.result.actionError); assert.ok(statusError);
  h.advance(9999); h.render(); assert.ok(h.result.actionError);
  h.advance(1); h.render(); assert.equal(h.result.actionError, null); assert.equal(h.result.statusError, statusError);
  h.api.loadNativeSubscriptionStatus = async () => free;
  h.iap.fetchProducts = async () => { throw Error('catalog failed'); };
  await h.result.retry(); await h.flush(); const catalogError = h.result.catalogError;
  assert.ok(catalogError); h.advance(10000); h.render(); assert.equal(h.result.catalogError, catalogError);
  h.unmount();
});

test('repeated identical action errors get a fresh timer; old callbacks cannot clear them', async () => {
  const h = hookHarness(); await h.flush();
  h.iap.getAvailablePurchases = async () => { throw Error('restore failed'); };
  await h.result.restore(); await h.flush();
  const old = [...h.timers.values()][0].fn;
  h.advance(9000);
  await h.result.restore(); await h.flush();
  old(); h.render(); assert.ok(h.result.actionError);
  h.advance(9999); h.render(); assert.ok(h.result.actionError);
  h.advance(1); h.render(); assert.equal(h.result.actionError, null);
  h.unmount();
});

for (const mode of ['switch', 'unmount']) test(`action error timers are cleared on ${mode}`, async () => {
  const h = hookHarness(); await h.flush();
  h.iap.getAvailablePurchases = async () => { throw Error('restore failed'); };
  await h.result.restore(); await h.flush(); const old = [...h.timers.values()][0].fn;
  if (mode === 'switch') {
    h.switch('owner-b'); await h.flush(); assert.equal(h.timers.size, 0);
    await h.result.restore(); await h.flush(); old(); h.render(); assert.ok(h.result.actionError);
  }
  h.unmount(); assert.equal(h.timers.size, 0); old();
});

test('selected management sends the owned subscription ID without changing the provider URL', async()=>{
 const h=serviceHarness();h.payload={url:'https://apps.apple.com/account/subscriptions'};
 await h.api.openSubscriptionManagement('owner-a',()=>true,'sub-a');
 assert.equal(JSON.parse(h.requests[0][1].body).subscriptionId,'sub-a');assert.equal(h.opened.length,1);
});
test('provider return refresh needs both canonical status and details; failures retain access',async()=>{
 const h=hookHarness({summary:pro});await h.flush();let reads=0;
 h.api.loadNativeMembership=async()=>{reads++;return [];};
 await h.result.manage('sub-a');h.render();assert.equal(h.result.returnState,'pending');assert.equal(reads,0);
 h.resume('background');h.resume('active');await h.flush();assert.equal(reads,1);assert.equal(h.result.returnState,'refreshed');
 h.api.loadNativeMembership=async()=>{throw Error('offline');};await h.result.manage('sub-a');h.resume('background');h.resume('active');await h.flush();
 assert.equal(h.result.returnState,'unknown');assert.equal(h.result.status.isPro,true);h.unmount();
});
test('late membership read cannot cross accounts or replace newer results',async()=>{
 const h=hookHarness({summary:pro});await h.flush();const gate=deferred();h.api.loadNativeMembership=()=>gate.promise;
 const old=h.result.refreshMembership();h.switch('owner-b');await h.flush();gate.resolve([{id:'old'}]);await old;h.render();assert.equal(h.result.memberships,null);h.unmount();
});
test('manual and unknown membership never show a cancellation entry',()=>{
 for(const status of [null,{...pro,primaryProvider:'manual',activeProviders:[]},{...pro,primaryProvider:null,activeProviders:[]},{...pro,primaryProvider:'stripe',activeProviders:['stripe']},free])assert.ok(!screen({status}).nodes.some(n=>n.props.accessibilityLabel==='Cancel subscription'));
 for(const status of [pro,{...pro,status:'trialing'}])assert.ok(screen({status}).nodes.some(n=>n.props.accessibilityLabel==='Cancel subscription'));
});

test('explicit retry after failed provider-return read refreshes both sources and settles confirmation',async()=>{
 const h=hookHarness({summary:pro});await h.flush();let statusReads=0;
 h.api.loadNativeSubscriptionStatus=async()=>{statusReads++;return pro;};
 h.api.loadNativeMembership=async()=>{throw Error('offline');};await h.result.manage('sub-a');h.resume('background');h.resume('active');await h.flush();assert.equal(h.result.returnState,'unknown');
 h.api.loadNativeMembership=async()=>[];await h.result.retryMembership();h.render();assert.equal(h.result.returnState,'refreshed');assert.equal(statusReads,2);h.unmount();
});

test('a slower old return refresh cannot replace a newer confirmation',async()=>{
 const h=hookHarness({summary:pro});await h.flush();const gate=deferred();h.api.loadNativeMembership=()=>gate.promise;
 await h.result.manage('sub-a');h.resume('background');h.resume('active');await tick();
 h.api.loadNativeMembership=async()=>[];await h.result.retryMembership();h.render();assert.equal(h.result.returnState,'refreshed');
 gate.reject(Error('old response'));await h.flush();assert.equal(h.result.returnState,'refreshed');h.unmount();
});

const scheduledMembership={id:'sub-a',provider:'apple',plan:'monthly',status:'active',currentPeriodEnd:'2099-01-01T00:00:00Z',canCancel:true,cancellation:{state:'scheduled',end:'2099-01-01T00:00:00Z'}};
test('dedicated scheduled presentation requires current Apple evidence after authoritative refresh',()=>{
 const props={status:pro,managedId:'sub-a',memberships:[scheduledMembership],returnState:'refreshed'};
 const h=screen(props);assert.ok(h.nodes.some(n=>n.type==='Text'&&n.children.includes('Cancellation\nScheduled')));assert.match(h.text,/Access ends/);assert.doesNotMatch(h.text,/Thanks for|Pro is Active/);
 h.nodes.find(n=>n.props.accessibilityLabel==='Go back').props.onPress();assert.deepEqual(h.actions,['back']);
 h.nodes.find(n=>n.props.accessibilityLabel==='Manage subscription').props.onPress();assert.deepEqual(h.actions,['back','manage']);
 for(const patch of [{returnState:'pending'},{returnState:'unknown'},{returnState:'idle'},{status:null},{status:free},{membershipError:'Unavailable'},{membershipLoading:true},{memberships:[{...scheduledMembership,provider:'stripe'}]},{memberships:[{...scheduledMembership,cancellation:{state:'unknown',end:null}}]},{memberships:[{...scheduledMembership,status:'revoked'}]},{memberships:[{...scheduledMembership,currentPeriodEnd:'2000-01-01T00:00:00Z'}]}]){
  const rendered=screen({...props,...patch});assert.ok(!rendered.nodes.some(n=>n.type==='Text'&&n.children.includes('Cancellation\nScheduled')));
 }
});
test('scheduled Apple state omits an unknown end and never claims future unverified access',()=>{
 const h=screen({status:pro,managedId:'sub-a',memberships:[{...scheduledMembership,cancellation:{state:'scheduled',end:null}}],returnState:'refreshed'});
 assert.match(h.text,/Apple has confirmed/);assert.doesNotMatch(h.text,/Access ends|until this date/);
});
