import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText,
    { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
function helper(platform, openURL) {
  return load('lib/crisisSupport.ts', { 'react-native': { Platform: { OS: platform }, Linking: { openURL } } });
}
function sheet(openURL) {
  const api = helper('ios', openURL), state = [], refs = [], cleanups = [];
  let i = 0, r = 0, closed = 0;
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: initial => { const n = i++; if (!(n in state)) state[n] = initial; return [state[n], value => { state[n] = typeof value === 'function' ? value(state[n]) : value; }]; },
    useRef: initial => { const n = r++; return refs[n] ??= { current: initial }; },
    useEffect: fn => { if (!cleanups.length) cleanups.push(fn()); } };
  const Component = load('components/CrisisSupportSheet.tsx', { react,
    'react-native': { Modal: 'Modal', View: 'View', Pressable: 'Pressable', Text: 'Text', ScrollView: 'ScrollView', Platform: { OS: 'ios' } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@expo/vector-icons': { Feather: 'Feather' },
    '../theme': { colors: { text: '#fff' } }, '../lib/crisisSupport': api }).default;
  return { render: () => { i = r = 0; return Component({ onClose: () => closed++ }); }, state, unmount: () => cleanups.forEach(fn => fn?.()), closed: () => closed };
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : []; }
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('four verified services have coverage/hours and explicit targets on both platforms', async () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], api = helper(platform, async url => calls.push(url));
    assert.deepEqual(Array.from(api.crisisServices, x => x.id), ['emergency', 'samaritans', 'shout', 'calm']);
    for (const id of ['emergency', 'samaritans', 'shout', 'calm', 'local']) assert.equal(await api.openCrisisSupport(id), null);
    assert.deepEqual(calls, ['tel:999', 'tel:116123', platform === 'ios' ? 'sms:85258' : 'smsto:85258', 'tel:0800585858', 'https://findahelpline.com/']);
    assert.match(api.crisisServices[1].detail, /UK and Ireland.*24 hours/);
    assert.match(api.crisisServices[2].detail, /Text SHOUT.*supported networks/);
    assert.match(api.crisisServices[3].detail, /over 18.*5pm–midnight UK time every day/);
    assert.match(api.outsideUKCopy, /may not work abroad.*Choose your country/);
  }
});
test('render and close never launch a call/message; all five actions stay available', () => {
  const calls = [], ui = sheet(async url => calls.push(url));
  const tree = ui.render(), buttons = nodes(tree).filter(n => n.type === 'Pressable');
  assert.equal(buttons.length, 7); assert.equal(calls.length, 0);
  tree.props.onRequestClose(); assert.equal(ui.closed(), 1); assert.equal(calls.length, 0);
  assert.ok(buttons.every(b => /48px|absolute inset/.test(b.props.className)));
});
test('launch failures are inline per action and leave every other option available', async () => {
  const ui = sheet(async () => { throw new Error('native failure'); });
  for (const button of nodes(ui.render()).filter(n => n.type === 'Pressable').slice(2)) button.props.onPress();
  await tick();
  const tree = ui.render();
  assert.equal(nodes(tree).filter(n => n.props.accessibilityRole === 'alert').length, 5);
  assert.equal(nodes(tree).filter(n => n.type === 'Pressable' && !n.props.disabled).length, 7);
  assert.match(JSON.stringify(tree), /Dial 999 manually|dial 999 manually/);
  assert.doesNotMatch(JSON.stringify(tree), /native failure|Retry/);
});
test('duplicate taps are guarded and closing prevents late failure state updates', async () => {
  let reject, calls = 0;
  const ui = sheet(() => { calls++; return new Promise((_, no) => { reject = no; }); });
  const action = nodes(ui.render()).filter(n => n.type === 'Pressable')[2];
  action.props.onPress(); action.props.onPress(); assert.equal(calls, 1);
  ui.unmount(); reject(new Error('late')); await tick(); assert.equal(ui.state[0].emergency, null);
});
test('returning from cancelled composer claims no delivery and keeps sheet open', async () => {
  const calls = [], ui = sheet(async url => calls.push(url));
  nodes(ui.render()).filter(n => n.type === 'Pressable')[4].props.onPress(); await tick();
  assert.deepEqual(calls, ['sms:85258']); assert.equal(ui.closed(), 0);
  assert.equal(nodes(ui.render()).filter(n => n.props.accessibilityRole === 'alert').length, 0);
  assert.doesNotMatch(JSON.stringify(ui.render()), /Message sent|Call completed/);
});
test('logged-out tabs expose Mind and support sheet is not session gated', () => {
  assert.match(read('contexts/RootNavigator.tsx'), /!session \?[^]*?initialRouteName="Tabs"/);
  assert.match(read('navigation/BottomTabNavigator.tsx'), /<Tab.Screen name="Mind" component=\{MindScreen\}/);
  assert.match(read('screens/MindScreen.tsx'), /\{crisisOpen \? <CrisisSupportSheet/);
  assert.doesNotMatch(read('components/CrisisSupportSheet.tsx'), /useAuth|useEntitlement|requestPermissions|geolocation/);
});
