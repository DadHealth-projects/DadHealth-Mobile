import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function profileHarness() {
  const source = await read('screens/subscreens/ProfileScreen.tsx');
  const h = { owner: 'account-a', data: null, loading: false, actions: [], refreshCalls: 0,
    refresh: async () => {} };
  const slots = []; let cursor = 0;
  const react = {
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useCallback: fn => fn, useEffect() {},
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  };
  const mocks = {
    react: { ...react, default: react },
    'react-native': Object.fromEntries(['Alert', 'Image', 'Modal', 'Pressable', 'ScrollView', 'Text', 'View', 'ActivityIndicator'].map(n => [n, n])),
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Feather: 'Icon' },
    '@react-navigation/native': { useNavigation: () => ({ navigate: (...args) => h.actions.push(args), goBack() {} }) },
    'expo-image-picker': {}, 'expo-image-manipulator': {},
    '../../contexts/AuthContext': { useAuth: () => ({ session: {}, user: h.owner ? { id: h.owner } : null }) },
    '../../contexts/NetworkContext': { useNetworkStatus: () => ({ isOffline: false }) },
    '../../hooks/useDashboard': { useDashboard: () => ({ data: h.data, loading: h.loading, refresh: async () => { h.refreshCalls++; await h.refresh(); } }) },
    '../../hooks/useEntitlement': { useEntitlement: state => ({ ...state, can: () => state.isPro === null ? null : state.isPro || state.trialActive === true }) },
    '../../lib/proNavigation': { navigateToProSubscription: (_, ...args) => h.actions.push(['shared', ...args]) },
    '../../lib/supabase': { supabase: {} }, '../../theme': { colors: {} },
  };
  for (const name of ['AppTopBar', 'Card', 'FadeInView']) mocks[`../../components/${name}`] = { default: name };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText,
    { exports, process: { env: {} }, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  h.render = () => {
    cursor = 0; const tree = exports.default(); h.nodes = [];
    function visit(node) { if (Array.isArray(node)) node.forEach(visit); else if (node && typeof node === 'object') { h.nodes.push(node); visit(node.children); } }
    visit(tree); h.text = JSON.stringify(tree);
    h.card = h.nodes.find(n => n.props.accessibilityLabel?.startsWith('Membership.'));
    h.retry = h.nodes.find(n => n.props.accessibilityLabel === 'Try again');
  };
  h.render(); return h;
}

for (const [isPro, trialActive, title] of [[false, false, 'Free Plan'], [true, false, 'Dad Health Pro'], [true, true, 'Pro Trial']]) {
  test(`Profile verified membership renders ${title} and keeps existing navigation`, async () => {
    const h = await profileHarness(); h.data = { isPro, trialActive }; h.render();
    assert.equal(h.card.props.accessibilityLabel, `Membership. ${title}`);
    assert.equal(h.retry, undefined);
    h.card.props.onPress(); assert.equal(h.actions.length, 1);
    assert.equal(h.actions[0][0], isPro ? 'ProSubscription' : 'shared');
    assert.doesNotMatch(h.text, /Membership status unavailable|Check your connection|View Membership|View membership details/);
  });
}

test('Profile retains verified manual/paid access through refresh and failure, but clears on account switch', async () => {
  const h = await profileHarness(); h.data = { isPro: true, trialActive: false }; h.render();
  h.data = { isPro: null, trialActive: null }; h.loading = true; h.render();
  assert.match(h.card.props.accessibilityLabel, /Dad Health Pro/); assert.match(h.text, /Checking membership/);
  h.loading = false; h.render(); assert.match(h.card.props.accessibilityLabel, /Dad Health Pro/);
  h.owner = 'account-b'; h.render(); assert.match(h.card.props.accessibilityLabel, /temporarily unavailable/);
  assert.doesNotMatch(h.card.props.accessibilityLabel, /Dad Health Pro|Free Plan/);
  h.data = { isPro: false, trialActive: false }; h.render(); assert.match(h.card.props.accessibilityLabel, /Free Plan/);
});

test('Profile unknown loading settles to one inline retry; repeat taps and failed retry do not navigate', async () => {
  const h = await profileHarness(); h.loading = true; h.render();
  assert.match(h.card.props.accessibilityLabel, /Checking membership\.\.\./);
  assert.equal(h.nodes.filter(n => n.type === 'ActivityIndicator').length, 1);
  assert.equal(h.retry, undefined);
  h.loading = false; h.render(); assert.match(h.card.props.accessibilityLabel, /temporarily unavailable/);
  assert.equal(h.nodes.filter(n => n.type === 'ActivityIndicator').length, 0);
  let reject; h.refresh = () => new Promise((_, no) => { reject = no; });
  let stopped = 0; const event = { stopPropagation() { stopped++; } };
  h.retry.props.onPress(event); h.retry.props.onPress(event);
  assert.equal(h.refreshCalls, 1); assert.equal(stopped, 2); assert.equal(h.actions.length, 0);
  reject(Error('server error')); await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.match(h.card.props.accessibilityLabel, /temporarily unavailable/); assert.ok(h.retry);
  h.refresh = async () => { h.data = { isPro: true, trialActive: true }; };
  h.retry.props.onPress(event); await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.equal(h.refreshCalls, 2); assert.match(h.card.props.accessibilityLabel, /Pro Trial/);
});

test('Account Sheet upgrade and membership entries reach the same subscription screen', async () => {
  const account = await read('components/AccountSheet.tsx');
  assert.match(account, /title: isConfirmedFree \? 'Upgrade to Pro' : 'Membership'/);
  assert.match(account, /navigateToProSubscription\(navigation, 'account', 'Dad Health Pro'/);
  assert.match(account, /navigation\.navigate\('ProSubscription', \{ source: 'account_membership'/);
});
