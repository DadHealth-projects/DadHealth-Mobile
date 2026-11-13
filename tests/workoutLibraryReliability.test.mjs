import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { selectWeeklyWorkout } from '../lib/weeklyWorkoutSelection.js';
import { createFitnessLibraryRefreshGate, shouldRefreshFitnessLibraryOnResume } from '../lib/fitnessLibraryRefresh.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const compile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
} }).outputText;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const workout = (id, source = 'admin') => ({ id, title: id, source, exercises: [], duration_mins: 10, equipment: 'none', focus: 'full_body' });

function harness() {
  const slots = [], effects = []; let cursor = 0, pending = [], owner = 'first', offline = false;
  const replies = { admin: { data: [workout('weekly'), workout('other')], error: null },
    generated: { data: [workout('mine', 'ai_generated')], error: null },
    assignment: { data: { workout_id: 'weekly' }, error: null } };
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(callback, deps) { const i = cursor++; if (!depsEqual(slots[i]?.deps, deps)) slots[i] = { callback, deps }; return slots[i].callback; },
    useEffect(callback, deps) { const i = cursor++; if (!depsEqual(effects[i]?.deps, deps)) pending.push(() => {
      effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: callback() };
    }); },
  };
  const mocks = {
    react, 'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    '@react-navigation/native': { useFocusEffect() {} },
    '../contexts/NetworkContext': { useNetworkStatus: () => ({ isOffline: offline }) },
    '../lib/fitnessLibraryRefresh': { createFitnessLibraryRefreshGate, shouldRefreshFitnessLibraryOnResume },
    '../lib/weeklyWorkoutSelection': { selectWeeklyWorkout },
    '../lib/supabase': { supabase: { from(table) {
      let key = table === 'free_weekly_workout_assignments' ? 'assignment' : 'admin';
      return { select() { return this; }, eq(column, value) { if (column === 'source' && value === 'ai_generated') key = 'generated'; return this; },
        order() { return this; }, limit() { return this; }, maybeSingle() { return this; },
        then(yes, no) { return Promise.resolve(replies[key]).then(yes, no); } };
    } } },
  };
  const exports = {};
  vm.runInNewContext(compile(read('hooks/useFitnessLibrary.ts')), { exports, require: (name) => {
    assert.ok(name in mocks, name); return mocks[name];
  } });
  const h = { replies, result: null, render() { cursor = 0; pending = []; h.result = exports.useFitnessLibrary(owner); pending.forEach((effect) => effect()); return h.result; },
    async settle() { await tick(); h.render(); },
    owner(value) { owner = value; h.render(); }, offline(value) { offline = value; h.render(); },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
  h.render(); return h;
}

function modal(fitnessLibrary, access, loading = false) {
  const source = read('screens/FitnessScreen.tsx');
  const expression = source.match(/const availableWorkouts = useMemo\(\s*\(\) => ([\s\S]*?),\n    \[/)[1];
  const state = { fitnessLibrary, workoutLibraryAccess: access, weeklyWorkoutAccess: true, hasUser: true, loading };
  state.availableWorkouts = vm.runInNewContext(expression, state);
  const definitions = source.slice(source.indexOf('  const libraryProblem ='), source.indexOf('  useEffect(() => {', source.indexOf('  const libraryProblem =')));
  const start = source.indexOf('<ScrollView contentContainerStyle={{ paddingHorizontal: 24');
  const jsx = source.slice(start, source.indexOf('</ScrollView>', start) + '</ScrollView>'.length);
  const exports = {}, actions = [];
  vm.runInNewContext(compile(`${definitions}\nexport function render() { return (${jsx}); }`), {
    ...state, exports, React: { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) },
    ScrollView: 'ScrollView', View: 'View', Text: 'Text', TagPill: 'TagPill', InlineFormError: 'Error', LimeButton: 'Button', Pressable: 'Pressable',
    checkEntitlement: () => actions.push('access'), refreshLibrary: () => actions.push('library'),
    selectedWorkout: null, setSelectedWorkoutId() {}, setWorkoutLibraryOpen() {}, navigation: { navigate() {} },
    EQUIPMENT_LABEL: { none: 'None' }, FOCUS_LABEL: { full_body: 'Full body' },
  });
  const tree = exports.render(), nodes = [];
  function visit(value) { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') { nodes.push(value); visit(value.children); } }
  visit(tree);
  return { text: JSON.stringify(tree), actions, nodes, visible: state.availableWorkouts };
}

test('Pro gets admin plus owned generated workouts; Free gets only assigned workout', async () => {
  const h = harness(); await h.settle();
  assert.deepEqual(Array.from(modal(h.result, true).visible, (item) => item.id), ['mine', 'weekly', 'other']);
  assert.deepEqual(Array.from(modal(h.result, false).visible, (item) => item.id), ['weekly']); h.unmount();
});

test('unknown access never exposes Pro rows or claims empty; Retry verifies access', async () => {
  const h = harness(); h.replies.assignment = { data: null, error: null }; await h.settle();
  const view = modal(h.result, null);
  assert.equal(view.visible.length, 0); assert.match(view.text, /verify your access/);
  assert.doesNotMatch(view.text, /No workouts are available yet/);
  view.nodes.find((node) => node.props.label === 'Retry').props.onPress(); assert.deepEqual(view.actions, ['access']); h.unmount();
});

test('successful zero rows is genuine empty; failed query offers library Retry and recovers', async () => {
  const h = harness(); h.replies.admin = { data: [], error: null }; h.replies.generated = { data: [], error: null };
  await h.settle(); assert.match(modal(h.result, true).text, /No workouts are available yet/);
  h.replies.admin = { data: null, error: { message: 'failed' } }; await h.result.refresh(); h.render();
  const failed = modal(h.result, true); assert.doesNotMatch(failed.text, /No workouts are available yet/);
  failed.nodes.find((node) => node.props.label === 'Try again').props.onPress(); assert.deepEqual(failed.actions, ['library']);
  h.replies.admin = { data: [workout('recovered')], error: null }; await h.result.refresh(); h.render();
  assert.equal(modal(h.result, true).visible[0].id, 'recovered'); h.unmount();
});

test('assignment failure retains successful Pro library but exposes no unassigned Free rows', async () => {
  const h = harness(); h.replies.assignment = Promise.reject(Error('assignment unavailable')); await h.settle();
  assert.equal(h.result.workouts.length, 3); assert.equal(h.result.assignmentKnown, false);
  assert.equal(modal(h.result, true).visible.length, 3);
  const free = modal(h.result, false); assert.equal(free.visible.length, 0);
  assert.doesNotMatch(free.text, /No workout has been assigned/); h.unmount();
});

test('background loading and recoverable error keep prior rows visible', async () => {
  const h = harness(); await h.settle(); let release;
  h.replies.admin = new Promise((resolve) => { release = resolve; });
  const refresh = h.result.refresh(); h.render();
  assert.equal(h.result.loading, true); assert.equal(modal(h.result, true).visible.length, 3);
  assert.match(modal(h.result, true).text, /Select other/);
  release({ data: null, error: { message: 'offline' } }); await refresh; h.render();
  assert.equal(h.result.workouts.length, 3); assert.match(modal(h.result, true).text, /Select other/); h.unmount();
});

test('account changes hide retained rows immediately and unmount invalidates pending work', async () => {
  const h = harness(); await h.settle(); let release;
  h.replies.admin = new Promise((resolve) => { release = resolve; }); h.owner('second');
  assert.equal(h.result.workouts.length, 0); h.unmount();
  release({ data: [workout('late')], error: null }); await tick();
  h.render(); assert.equal(h.result.workouts.length, 0);
});

test('Today request opens existing modal once and is consumed before normal return', () => {
  const today = read('screens/DashboardScreen.tsx'), body = read('screens/FitnessScreen.tsx');
  assert.match(today, /screen: 'Fit',\s*params: \{ openWorkoutLibrary: true \}/);
  const effect = body.match(/useEffect\(\(\) => \{\n    if \(!standalone \|\| !openWorkoutLibrary\)[\s\S]*?\}, \[tabNavigation, openWorkoutLibrary, standalone\]\);/)[0];
  const state = { standalone: true, openWorkoutLibrary: true, opened: 0, useEffect: (work) => work(),
    setWorkoutLibraryOpen: (value) => { if (value) state.opened++; },
    tabNavigation: { setParams: (params) => { state.openWorkoutLibrary = params.openWorkoutLibrary; } } };
  vm.runInNewContext(compile(effect), state); assert.equal(state.opened, 1);
  vm.runInNewContext(compile(effect), state); assert.equal(state.opened, 1);
  assert.match(body, /accessibilityLabel="Close Workout Library"/);
  assert.match(body, /onRequestClose=\{\(\) => setWorkoutLibraryOpen\(false\)\}/);
});
