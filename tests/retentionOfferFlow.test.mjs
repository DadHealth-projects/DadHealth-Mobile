import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Brief 01 last-resort offer, app side. Harness pattern from nativeSubscriptionReliability.test.mjs.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
function load(path, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(compile(read(path)), { exports, ...globals, require(name) {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name]; } });
  return exports;
}
const monthly = 'co.uk.dadhealth.pro.monthly';
const signed = { identifier: 'retention_50_3m', keyIdentifier: 'KEY123', nonce: 'n-1', signature: 'c2ln', timestamp: 1764000000000 };
const pro = { isPro: true, canPurchase: false, status: 'active', primaryProvider: 'apple', activeProviders: ['apple'],
  plan: 'monthly', productId: monthly, currentPeriodEnd: '2027-01-01T00:00:00Z' };
const tick = () => new Promise((resolve) => setImmediate(resolve));

function service({ os = 'ios', respond } = {}) {
  const h = { requests: [] };
  h.api = load('lib/nativeSubscriptions.ts', {
    'react-native': { Platform: { OS: os }, Linking: {} }, 'expo-constants': { default: { appOwnership: 'standalone' } },
    './supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't', user: { id: 'owner-a' } } }, error: null }) } } },
  }, { process: { env: { EXPO_PUBLIC_APPLE_IAP_PRO_MONTHLY_PRODUCT_ID: monthly } },
    fetch: async (...args) => { h.requests.push(args); return respond(); }, setTimeout, clearTimeout, AbortController });
  return h;
}
const ok = (body) => () => ({ ok: true, status: 200, json: async () => body });

test('offer loader: posts the subscription id and returns only a well-formed signed offer for a configured product', async () => {
  const h = service({ respond: ok({ state: 'available', productId: monthly, offer: { ...signed, extra: 'dropped' } }) });
  const result = await h.api.loadRetentionOffer('owner-a', 'sub-1');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { productId: monthly, offer: signed });
  assert.match(h.requests[0][0], /\/api\/native-subscriptions\/retention-offer$/);
  assert.deepEqual(JSON.parse(h.requests[0][1].body), { subscriptionId: 'sub-1' });
});

test('offer loader: not configured, not eligible, malformed, wrong product, network failure and Android all mean "no offer"', async () => {
  const cases = [
    () => ({ ok: false, status: 404, json: async () => ({ state: 'offer_unavailable' }) }),
    () => ({ ok: false, status: 503, json: async () => ({ error: 'offer_check_failed' }) }),
    ok({ state: 'available', productId: monthly, offer: { ...signed, signature: '' } }),
    ok({ state: 'available', productId: 'some.other.product', offer: signed }),
    ok({ state: 'available', productId: monthly, offer: { ...signed, timestamp: 'soon' } }),
    () => { throw new Error('Network request failed'); },
  ];
  for (const respond of cases) assert.equal(await service({ respond }).api.loadRetentionOffer('owner-a', 'sub-1'), null);
  const android = service({ os: 'android', respond: ok({ state: 'available', productId: monthly, offer: signed }) });
  assert.equal(await android.api.loadRetentionOffer('owner-a', 'sub-1'), null);
  assert.equal(android.requests.length, 0, 'Android never asks: the offer is Apple-only');
});

function hook({ applied = true } = {}) {
  const svc = service({ respond: ok({}) }).api;
  const slots = [], effects = []; let cursor = 0, pending = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
      return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(init) { const i = cursor++; return slots[i] ??= { current: init }; },
    useCallback(cb, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: cb, deps }; return slots[i].value; },
    useMemo(cb, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: cb(), deps }; return slots[i].value; },
    useEffect(cb, deps) { const i = cursor++; if (!same(effects[i]?.deps, deps)) pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: cb() }; }); },
  };
  const h = { requests: [], verifies: [], finishes: [], update: null, error: null, purchaseThrows: null };
  h.iap = {
    initConnection: async () => true, endConnection: async () => {},
    purchaseUpdatedListener(fn) { h.update = fn; return { remove() {} }; },
    purchaseErrorListener(fn) { h.error = fn; return { remove() {} }; },
    fetchProducts: async () => [], isEligibleForIntroOfferIOS: async () => true,
    requestPurchase: async (request) => { h.requests.push(request); if (h.purchaseThrows) throw h.purchaseThrows; },
    getAvailablePurchases: async () => [], finishTransaction: async ({ purchase }) => { h.finishes.push(purchase.id); },
  };
  const api = { ...svc, getNativeIapModule: () => h.iap, loadNativeSubscriptionStatus: async () => pro,
    prepareNativePurchase: async () => { throw new Error('unused'); }, openSubscriptionManagement: async () => {}, loadNativeMembership: async () => [],
    verifyNativePurchase: async (purchase, account) => { h.verifies.push([purchase.id, account]); return { ...pro, retentionOfferApplied: applied }; } };
  const module = load('hooks/useNativeSubscriptions.ts', { react,
    '../contexts/NetworkContext': { useNetworkStatus: () => ({ isOffline: false }) },
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener() { return { remove() {} }; } } },
    '../lib/nativeSubscriptions': api }, { setTimeout, clearTimeout });
  h.render = () => { cursor = 0; pending = []; h.result = module.useNativeSubscriptions('owner-a', () => {}); pending.forEach((e) => e()); return h.result; };
  h.flush = async () => { await tick(); h.render(); await tick(); h.render(); };
  h.render();
  return h;
}
const offer = { productId: monthly, offer: signed };
const receipt = (purchaseState = 'purchased') => ({ id: 'tx-offer', productId: monthly, purchaseToken: 'signed-jws', purchaseState });

test('accepting buys the same product with the signed offer and the member account token', async () => {
  const h = hook(); await h.flush();
  assert.equal(await h.result.redeemRetentionOffer(offer), true);
  h.render();
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0])), { type: 'subs', request: { apple: { sku: monthly, appAccountToken: 'owner-a', withOffer: signed } } });
  assert.equal(h.result.offerOutcome, 'redeeming');
});

test('accepted only after server verification shows Apple applied our offer', async () => {
  const h = hook({ applied: true }); await h.flush();
  await h.result.redeemRetentionOffer(offer);
  await h.update(receipt()); await h.flush();
  assert.deepEqual(h.verifies[0], ['tx-offer', 'owner-a']);
  assert.equal(h.result.offerOutcome, 'accepted');
});

test('a verified purchase without the offer applied is never shown as accepted', async () => {
  const h = hook({ applied: false }); await h.flush();
  await h.result.redeemRetentionOffer(offer);
  await h.update(receipt()); await h.flush();
  assert.equal(h.result.offerOutcome, 'failed');
});

test('closing the store sheet is "cancelled"; a store failure is "failed"; a pending purchase is "pending"', async () => {
  let h = hook(); await h.flush();
  h.purchaseThrows = { code: 'user-cancelled', message: 'cancelled' };
  await h.result.redeemRetentionOffer(offer); h.render();
  assert.equal(h.result.offerOutcome, 'cancelled');

  h = hook(); await h.flush();
  h.purchaseThrows = { code: 'network-error', message: 'offline' };
  await h.result.redeemRetentionOffer(offer); h.render();
  assert.equal(h.result.offerOutcome, 'failed');

  h = hook(); await h.flush();
  await h.result.redeemRetentionOffer(offer);
  h.error({ code: 'user-cancelled', message: 'cancelled' }); h.render();
  assert.equal(h.result.offerOutcome, 'cancelled', 'sheet closed after requestPurchase resolved');

  h = hook(); await h.flush();
  await h.result.redeemRetentionOffer(offer);
  await h.update(receipt('pending')); h.render();
  assert.equal(h.result.offerOutcome, 'pending');
});

test('a second tap while redeeming starts nothing (no duplicate redemption from the app)', async () => {
  const h = hook(); await h.flush();
  assert.equal(await h.result.redeemRetentionOffer(offer), true);
  assert.equal(await h.result.redeemRetentionOffer(offer), false);
  assert.equal(h.requests.length, 1);
});

test('cancellation flow: offer only when signed, normal cancellation always available, kept only on accepted', () => {
  const ui = read('components/subscriptions/CancellationFlow.tsx');
  assert.match(ui, /if \(offline \|\| !loadOffer \|\| !redeemOffer\) \{ setStep\('handoff'\); return; \}/, 'no offer support or offline: unchanged hand-off');
  assert.match(ui, /setStep\(signed \? 'offer' : 'handoff'\);/, 'no signed offer: unchanged hand-off');
  assert.match(ui, /\{step === 'offer' \? <Action outlined label=\{OFFER_COPY\.decline\} onPress=\{\(\) => setStep\('handoff'\)\} \/> : null\}/,
    'the decline button is never disabled');
  assert.match(ui, /if \(step === 'offer' && offerOutcome === 'accepted'\) setStep\('kept'\);/, '"You\'re staying" only after verified acceptance');
  const accept = ui.slice(ui.indexOf('const acceptOffer'), ui.indexOf('const handoff'));
  assert.ok(accept.indexOf('saveCancellationFeedback') < accept.indexOf('await redeemOffer(offer)'), 'the reason is saved before redeeming');
  // Client audit A3: a failed reason save never blocks the offer and is queued durably with the
  // same request id; it is never marked saved until the server confirms.
  assert.match(accept, /catch \{\r?\n\s+\/\/ Never blocks the offer, and never silently lost/);
  assert.match(accept, /await enqueueOfflineWrite\(\{ id: pending\.id, userId: owner, kind: 'cancellation_feedback'/);
  assert.match(accept, /catch \{ \/\* the offer still proceeds; the store outcome is recorded server-side \*\/ \}/);
  assert.doesNotMatch(accept.slice(accept.indexOf('enqueueOfflineWrite')), /pending\.saved = true/);
});

test('the Pro screen wires the offer to the member\'s own subscription and resets it on close', () => {
  const screen = read('screens/subscreens/ProSubscriptionScreen.tsx');
  assert.match(screen, /loadOffer=\{\(subscriptionId\) => loadRetentionOffer\(user\.id, subscriptionId\)\}/);
  assert.match(screen, /redeemOffer=\{subscriptions\.redeemRetentionOffer\} offerOutcome=\{subscriptions\.offerOutcome\}/);
  assert.match(screen, /onClose=\{\(\) => \{ subscriptions\.resetOfferOutcome\(\); setCancellationOwner\(null\); \}\}/);
});
