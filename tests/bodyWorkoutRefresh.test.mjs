import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function renderShell(props) {
  const exports = {};
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [value, () => {}], useCallback: (fn) => fn,
    useEffect: (fn) => { fn(); },
  };
  const mocks = {
    react,
    'react-native': { RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    './AppTopBar': { default: 'AppTopBar' },
    './GlobalErrorToastReporter': { default: 'Error' },
    '../contexts/NetworkContext': { useNetworkStatus: () => ({ dismissToast() {} }) },
    '../theme': { colors: {} },
  };
  const code = ts.transpileModule(read('components/PillarScreen.tsx'), { compilerOptions: {
    jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => mocks[name], setTimeout: () => 1, clearTimeout() {} });
  return JSON.stringify(exports.default({ children: 'retained-workout', skeleton: 'initial-skeleton', ...props }));
}

test('Body shell keeps content mounted during refresh; first load still has skeleton', () => {
  assert.match(renderShell({ refreshing: true, preserveContentOnRefresh: true }), /retained-workout/);
  assert.doesNotMatch(renderShell({ refreshing: true, preserveContentOnRefresh: true }), /initial-skeleton/);
  assert.match(renderShell({ loading: true, preserveContentOnRefresh: true }), /initial-skeleton/);
});

test('other pillar screens keep existing behaviour until their batch is approved', () => {
  assert.match(renderShell({ refreshing: true }), /initial-skeleton/);
});

test('optional Body summary refresh cannot replace an available dashboard', () => {
  const screen = read('screens/FitnessScreen.tsx');
  const expression = screen.match(/<PillarScreen\s+loading=\{([^\n]+)\}/)[1];
  const evaluate = (data, loading) => vm.runInNewContext(expression, { data, loading, standalone: true, summaryLoading: true });
  assert.equal(evaluate({}, false), false);
  assert.equal(evaluate({}, true), false);
  assert.equal(evaluate(null, true), true);
  assert.match(screen, /preserveContentOnRefresh/);
});
