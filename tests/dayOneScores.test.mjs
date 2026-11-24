import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Client-approved 2026-11-23: valid scores are visible from day one for every
// account; week-on-week trends wait for the server's baseline.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, mocks) {
  const exports = {};
  const module = { exports };
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
  } }).outputText, { exports, module, Math, Number, String, Object, Array, require(name) {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name];
  } });
  return module.exports;
}
const react = { memo: (fn) => fn, useEffect() {}, useRef: (value) => ({ current: value }),
  createElement: (type, props, ...children) => (typeof type === 'function' ? type({ ...props, children }) : { type, props: { ...props, children } }) };
const reactMock = { ...react, default: react };
const scoreTrends = load('lib/scoreTrends.js', {});
const native = { Pressable: 'Pressable', Text: 'Text', View: 'View', useWindowDimensions: () => ({ width: 390 }) };
const icons = { Feather: 'Feather', MaterialCommunityIcons: 'MaterialCommunityIcons' };

const DadScoreCard = load('components/dashboard/DadScoreCard.tsx', {
  react: reactMock, 'react-native': native, '@expo/vector-icons': icons,
  '../../lib/scoreTrends': scoreTrends, '../../lib/analytics': { trackEvent() {} },
}).default;
const PillarScoreRow = load('components/dashboard/PillarScoreRow.tsx', {
  react: reactMock, 'react-native': native, '../../lib/scoreTrends': scoreTrends,
}).default;
const BondScoreCard = load('components/bond/BondScoreCard.tsx', {
  react: reactMock, 'react-native': native, '@expo/vector-icons': icons,
  '../../theme': { colors: { dark: '#0A0A0A' } }, '../../lib/scoreTrends': scoreTrends,
}).default;

function nodes(tree) {
  const out = [];
  const visit = (n) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(visit); return; } out.push(n); visit(n.props?.children); };
  visit(tree); return out;
}
/** Each Text node's string pieces joined exactly as rendered. */
const texts = (tree) => nodes(tree).filter((n) => n.type === 'Text')
  .map((n) => [n.props.children].flat(Infinity).filter((x) => typeof x === 'string' || typeof x === 'number').join(''))
  .filter(Boolean);
const bars = (tree) => nodes(tree).filter((n) => typeof n.props?.style?.width === 'string').map((n) => n.props.style.width);
const items = (values, trends = [null, null, null], warning = false) => ['Mind', 'Body', 'Bond'].map((label, i) => ({
  label, value: values[i], trend: trends[i], showNeutralTrend: true, warning: warning && i === 0,
}));

test('day one: total and pillar scores, and their bars, show while only trends wait for the baseline', () => {
  const tree = DadScoreCard({ score: 34, baselineBuilding: true, missingScore: '—', items: items([40, 22, 40], [3, -2, 0], true) });
  const shown = texts(tree);
  for (const value of ['34', '40%', '22%']) assert.ok(shown.includes(value), value);
  assert.deepEqual(bars(tree), ['40%', '22%', '40%']);
  assert.ok(shown.includes('Building first 7 day trend'));
  assert.ok(!shown.some((t) => /pts|↑|↓|→|·/.test(t)), 'no trend or placeholder on day one');
  assert.ok(!nodes(tree).some((n) => n.props?.style?.backgroundColor === 'rgba(184, 74, 66, 0.2)'), 'comparison warning waits for baseline');
});

test('after the baseline, trends and warnings return and the baseline message goes', () => {
  const tree = DadScoreCard({ score: 34, baselineBuilding: false, missingScore: '—', items: items([40, 22, 40], [3, -2, null], true) });
  const shown = texts(tree);
  assert.ok(!shown.includes('Building first 7 day trend'));
  assert.ok(shown.some((t) => t.includes('3 pts')));
  assert.ok(shown.some((t) => t.includes('2 pts')));
  assert.ok(nodes(tree).some((n) => n.props?.style?.backgroundColor === 'rgba(184, 74, 66, 0.2)'));
});

test('a genuine zero is shown; a missing score is "—", never a fabricated 0', () => {
  const zero = texts(DadScoreCard({ score: 0, baselineBuilding: true, missingScore: '—', items: items([0, 0, 0]) }));
  assert.ok(zero.includes('0')); assert.ok(zero.includes('0%'));
  const missing = DadScoreCard({ score: null, baselineBuilding: true, missingScore: '—', items: items([null, null, null]) });
  const shown = texts(missing);
  assert.ok(shown.includes('—')); assert.ok(!shown.includes('0') && !shown.includes('0%'));
  assert.deepEqual(bars(missing), []);
});

test('loading placeholder and score errors stay distinct from day-one scores', () => {
  const loading = texts(DadScoreCard({ score: null, missingScore: '—', missingItemValue: '—', items: items([null, null, null]) }));
  assert.ok(loading.filter((t) => t === '—').length >= 4);
  assert.ok(!loading.includes('Building first 7 day trend'));
  const failed = DadScoreCard({ score: 34, scoreUnavailable: true, baselineBuilding: false, missingScore: '—', items: items([40, 22, 40], [3, 1, 0]) });
  const shown = texts(failed);
  assert.ok(shown.includes('Dad Health Score unavailable. Pull to refresh.'));
  assert.ok(!shown.some((t) => /34|40%|22%|pts|Building first/.test(t)));
  assert.deepEqual(bars(failed), []);
});

test('locked values keep their existing permission behaviour', () => {
  const tree = DadScoreCard({ score: 34, lockedValues: true, baselineBuilding: true, items: items([40, 22, 40]) });
  const shown = texts(tree);
  assert.ok(!shown.some((t) => /34|40%|22%/.test(t)));
  assert.ok(nodes(tree).filter((n) => n.type === 'Feather' && n.props.name === 'lock').length >= 4);
});

test('Mind and Body rows show the rounded score from day one with the baseline message in the trend slot', () => {
  const dayOne = PillarScoreRow({ pillar: 'Mind', score: 42.6, trend: 5, baselineBuilding: true });
  assert.deepEqual(texts(dayOne), ['Mind score', '43%', 'Building first 7 day trend']);
  assert.equal(dayOne.props.accessibilityLabel, 'Mind score 43 percent. Building first 7 day trend');
  const later = PillarScoreRow({ pillar: 'Body', score: 60, trend: 4, baselineBuilding: false });
  assert.ok(texts(later).includes('60%')); assert.ok(texts(later).some((t) => t.includes('4 pts')));
  assert.ok(!texts(later).includes('Building first 7 day trend'));
  assert.ok(texts(PillarScoreRow({ pillar: 'Body', score: 0, trend: null, baselineBuilding: true })).includes('0%'));
  for (const props of [{ score: null }, { score: 50, scoreUnavailable: true }]) {
    const row = PillarScoreRow({ pillar: 'Mind', trend: 3, baselineBuilding: true, ...props });
    assert.deepEqual(texts(row), ['Mind score', '—'], JSON.stringify(props));
    assert.equal(row.props.accessibilityLabel, 'Mind score unavailable');
  }
});

test('pillar trend label uses the right plural for screen readers', () => {
  const label = (trend) => PillarScoreRow({ pillar: 'Body', score: 60, trend, baselineBuilding: false }).props.accessibilityLabel;
  assert.equal(label(1), 'Body score 60 percent, trend ↑ 1 point');
  assert.equal(label(-1), 'Body score 60 percent, trend ↓ 1 point');
  assert.equal(label(4), 'Body score 60 percent, trend ↑ 4 points');
  assert.equal(label(0), 'Body score 60 percent, trend → 0 points');
});

test('Bond card shows the score and bar from day one; trends wait; missing and failed reads are "—"', () => {
  const dayOne = BondScoreCard({ score: 18.4, trend: 6, baselineBuilding: true });
  const shown = texts(dayOne);
  assert.ok(shown.includes('18')); assert.deepEqual(bars(dayOne), ['18%']);
  assert.ok(shown.includes('Building first 7 day trend')); assert.ok(!shown.some((t) => t.includes('pts')));
  const later = texts(BondScoreCard({ score: 18, trend: 6, baselineBuilding: false }));
  assert.ok(later.some((t) => t.includes('6 pts'))); assert.ok(!later.includes('Building first 7 day trend'));
  for (const props of [{ score: null }, { score: 40, scoreUnavailable: true }]) {
    const card = BondScoreCard({ trend: 2, baselineBuilding: true, ...props });
    assert.ok(texts(card).includes('—'), JSON.stringify(props)); assert.ok(!texts(card).includes('0'));
    assert.deepEqual(bars(card), [], JSON.stringify(props));
  }
});

test('every score surface receives server baseline state and no longer gates values on it', () => {
  const today = read('screens/DashboardScreen.tsx'), sheet = read('components/dashboard/ScoreDetailSheet.tsx');
  const bond = read('screens/BondScreen.tsx');
  assert.match(today, /<DadScoreCard\s+score=\{score\}\s+missingScore="—"\s+scoreUnavailable=\{Boolean\(data\.scoreError\)\}\s+baselineBuilding=\{!data\.scoreError && !data\.baselineAvailable\}/);
  assert.match(sheet, /items=\{items\} missingScore="—"/);
  // The Bond logging hint helps new accounts too.
  assert.match(bond, /\{data && !data\.scoreError && \(bondScore == null \|\| bondScore === 0\) \? \(/);
  assert.doesNotMatch(bond, /data\?\.baselineAvailable && \(bondScore/);
});

test('saved activities refresh canonical scores only after the save is confirmed', () => {
  const workout = read('components/fitness/ActiveWorkout.tsx');
  const failure = workout.indexOf("setMessage('We could not log this session. Please try again.');");
  const refresh = workout.indexOf('void refreshDashboardForUser(userId);');
  const completion = workout.indexOf("supabase.from('workout_completions').insert");
  assert.ok(failure > 0 && refresh > failure && refresh < completion, 'workout refresh follows a confirmed session save');
  assert.equal(workout.split('refreshDashboardForUser(').length - 1, 1);

  const manual = read('screens/subscreens/ManualActivityLogScreen.tsx');
  assert.ok(manual.indexOf('await refreshDashboardForUser(user.id);') < manual.indexOf('navigation.goBack();', manual.indexOf('await refreshDashboardForUser(user.id);') - 400));
  assert.match(manual, /notifyManualActivityChanged\(\);\s+await refreshDashboardForUser\(user\.id\);\s+navigation\.goBack\(\);/);

  const hook = read('hooks/useDashboard.ts');
  const listener = hook.slice(hook.indexOf('useEffect(() => subscribeOfflineSync((event) => {'), hook.indexOf('}), [userId]);', hook.indexOf('useEffect(() => subscribeOfflineSync((event) => {')));
  assert.match(listener, /if \(!userId \|\| event\.userId !== userId\) return;/);
  assert.match(listener, /if \(event\.kind === 'daily_checkin'\) \{[\s\S]*?event\.status === 'synced'[\s\S]*?refreshDashboardForUser\(userId\);[\s\S]*?return;\s*\}/);
  assert.match(listener, /if \(event\.kind === 'journal_create' && event\.status === 'synced'\) void refreshDashboardForUser\(userId\);/);
  // A failed journal sync never shows the check-in sync error.
  assert.equal(listener.split('Your saved check-in could not be synced.').length - 1, 1);
  assert.ok(listener.indexOf('Your saved check-in could not be synced.') < listener.indexOf("event.kind === 'journal_create'"));

  const presentDad = read('components/bond/PresentDadMode.tsx');
  assert.match(presentDad, /if \(result\.status === 'completed'\) onScoreRefresh\(\);/);
});
