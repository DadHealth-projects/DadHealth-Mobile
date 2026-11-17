import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Execute the actual screen callback with controlled resource promises.
const source = readFileSync(new URL('../screens/DashboardScreen.tsx', import.meta.url), 'utf8');
const callback = source.match(/const handleRefresh = useCallback\((async \(\) => \{[\s\S]*?\n  \}), \[/)[1];
function harness(refresh) {
  const h = { spinning: false, sectionCalls: 0, dismissals: 0 };
  const section = () => { h.sectionCalls++; return new Promise(() => {}); };
  h.run = vm.runInNewContext(`(${callback})`, {
    refreshInFlight: { current: false }, refresh,
    dismissToast: () => h.dismissals++, setRefreshing: value => h.spinning = value,
    refreshWeeklyWorkout: section, refreshCookTogether: section,
    latestReport: { refresh: section }, liveStreak: { refresh: section },
  });
  return h;
}

test('pending secondary sections do not lock Today refresh or prevent a later refresh', async () => {
  let dashboardCalls = 0;
  const h = harness(async () => dashboardCalls++);
  await h.run();
  assert.equal(h.spinning, false);
  assert.equal(h.sectionCalls, 4);
  await h.run();
  assert.equal(dashboardCalls, 2);
});

test('rapid pulls join the current gesture and completion releases its lock', async () => {
  let settle, calls = 0;
  const h = harness(() => { calls++; return new Promise(resolve => settle = resolve); });
  const pending = h.run();
  assert.equal(h.spinning, true);
  await h.run();
  assert.equal(calls, 1);
  settle(); await pending;
  assert.equal(h.spinning, false);
});

test('dashboard rejection still releases the spinner and gesture lock', async () => {
  const h = harness(async () => { throw Error('failed'); });
  await assert.rejects(h.run(), /failed/);
  assert.equal(h.spinning, false);
  await assert.rejects(h.run(), /failed/);
  assert.equal(h.dismissals, 2);
});
