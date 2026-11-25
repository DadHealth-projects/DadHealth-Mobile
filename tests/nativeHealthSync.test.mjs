import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const compile = (file) => ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const plain = (v) => JSON.parse(JSON.stringify(v));
const DAY = 86_400_000;

function loadCore() {
  const exports = {};
  vm.runInNewContext(compile('lib/healthSyncCore.ts'), { exports, Intl, Date, Math, Number, Map, Object, String, Array, Error });
  return exports;
}

/** Apple Health module with mocked HealthKit and Supabase. All data synthetic. */
function appleHarness({ steps = 'empty', workouts = [], sleep = [], timezone = 'Europe/London' } = {}) {
  const core = loadCore();
  const h = { session: 'user-a', rpc: [], updates: [], deletes: [], gate: null, core };
  const now = Date.now();
  const healthKit = {
    isHealthDataAvailable: () => true,
    AuthorizationRequestStatus: { unnecessary: 2, shouldRequest: 1 },
    getRequestStatusForAuthorization: async () => 2,
    requestAuthorization: async (opts) => { h.requested = opts.toRead; return true; },
    queryStatisticsCollectionForQuantity: async () => {
      if (h.gate) await h.gate;
      if (steps === 'fail') throw new Error('native read failed');
      if (steps === 'empty') return [];
      return steps.map(([offsetMs, value]) => ({ startDate: new Date(now - offsetMs), sumQuantity: { quantity: value } }));
    },
    queryWorkoutSamples: async () => workouts.map(([startOffset, minutes]) => ({
      startDate: new Date(now - startOffset), endDate: new Date(now - startOffset + minutes * 60_000), duration: { quantity: minutes * 60, unit: 's' },
    })),
    queryCategorySamples: async () => sleep,
  };
  const table = (name) => {
    const q = {
      select: () => q, eq: () => q,
      maybeSingle: async () => name === 'user_profile' ? { data: { timezone }, error: null } : { data: null, error: null },
      update: (v) => { h.updates.push([name, v]); return { eq: () => ({ eq: async () => ({ error: null }) }) }; },
      delete: () => { h.deletes.push(name); return { eq: () => ({ eq: async () => ({ error: null }) }) }; },
      upsert: async () => ({ error: null }),
    };
    return q;
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: h.session ? { user: { id: h.session } } : null } }) },
    from: table,
    rpc: async (name, args) => { h.rpc.push([name, plain(args)]); return { data: { metrics_written: args.p_metrics.length, sleep_written: args.p_sleep.length }, error: null }; },
  };
  const exports = {};
  vm.runInNewContext(compile('lib/appleHealth.ts'), {
    exports, Intl, Date, Math, Number, Map, Set, Object, String, Array, Error, Promise,
    require: (name) => ({
      'react-native': { Platform: { OS: 'ios' }, TurboModuleRegistry: { get: () => ({}) } },
      './supabase': { supabase },
      './dashboardFreshness': { markDashboardStale: () => {} },
      './healthSyncCore': core,
      '@kingstinct/react-native-healthkit': healthKit,
    })[name] ?? assert.fail(`unexpected import ${name}`),
  });
  h.api = exports;
  return h;
}

test('scope: reads steps, recorded workouts and sleep only; no resting heart rate or Apple Exercise Time', async () => {
  const h = appleHarness({ workouts: [[2 * DAY, 30]] });
  await h.api.connectAppleHealth('user-a');
  assert.deepEqual(plain(h.requested), ['HKQuantityTypeIdentifierStepCount', 'HKWorkoutTypeIdentifier', 'HKCategoryTypeIdentifierSleepAnalysis']);
  const metrics = h.rpc[0][1].p_metrics;
  assert.ok(metrics.every((m) => m.metric_type !== 'resting_hr'));
  const src = read('lib/appleHealth.ts');
  assert.doesNotMatch(src, /RestingHeartRate|AppleExerciseTime|resting_hr/);
  assert.doesNotMatch(read('app.json'), /READ_RESTING_HEART_RATE|resting heart rate/i);
});

test('workouts: actual durations feed active minutes once; days without workouts are genuine zeros', async () => {
  const h = appleHarness({ workouts: [[2 * DAY, 30], [2 * DAY - 10 * 60_000, 30]] });
  const result = await h.api.syncAppleHealth('user-a', 7);
  const active = h.rpc[0][1].p_metrics.filter((m) => m.metric_type === 'active_mins');
  assert.equal(active.length, 7, 'every day in the window is sent so corrections and deletions apply');
  assert.equal(active.reduce((sum, m) => sum + m.value, 0), 40, 'overlapping workouts (30 + 30 overlapping by 20) count 40 minutes, not 60');
  assert.ok(active.some((m) => m.value === 0), 'genuine zero days');
  assert.equal(result.readableData, true);
});

test('reconciliation: a failed read never sends values for that metric; an empty read cannot erase history', async () => {
  const failed = appleHarness({ steps: 'fail', workouts: [[DAY, 20]] });
  await failed.api.syncAppleHealth('user-a', 7);
  const metrics = failed.rpc[0][1].p_metrics;
  assert.ok(metrics.every((m) => m.metric_type !== 'steps'), 'failed step read sends no step rows');
  assert.ok(metrics.some((m) => m.metric_type === 'active_mins'));

  const empty = appleHarness();
  const result = await empty.api.syncAppleHealth('user-a', 7);
  assert.deepEqual(empty.rpc[0][1], { p_metrics: [], p_sleep: [] }, 'nothing readable: nothing overwritten');
  assert.equal(result.readableData, false, 'the screen can say no data was readable instead of claiming access');
});

test('account isolation: a sync started by A is discarded if B is signed in before the upload', async () => {
  const h = appleHarness({ workouts: [[DAY, 20]] });
  let release; h.gate = new Promise((r) => { release = r; });
  const pending = h.api.syncAppleHealth('user-a', 7);
  await new Promise((r) => setTimeout(r, 0));
  h.session = 'user-b';
  release();
  await assert.rejects(pending, (e) => e.name === 'StaleHealthSyncError');
  assert.equal(h.rpc.length, 0, "A's data is never uploaded under B's session");
  assert.equal(h.updates.length, 0);
});

test('disconnect cancels in-flight work and removes the link; later syncs for the old run are dropped', async () => {
  const h = appleHarness({ workouts: [[DAY, 20]] });
  let release; h.gate = new Promise((r) => { release = r; });
  const pending = h.api.syncAppleHealth('user-a', 7);
  await new Promise((r) => setTimeout(r, 0));
  await h.api.disconnectAppleHealth('user-a');
  release();
  await assert.rejects(pending, (e) => e.name === 'StaleHealthSyncError');
  assert.equal(h.rpc.length, 0);
  assert.deepEqual(h.deletes, ['user_integrations']);
});

test('calendar: workout days follow the saved account timezone', async () => {
  const london = appleHarness({ timezone: 'Europe/London', workouts: [[60 * 60_000, 20]] });
  const karachi = appleHarness({ timezone: 'Asia/Karachi', workouts: [[60 * 60_000, 20]] });
  await london.api.syncAppleHealth('user-a', 7);
  await karachi.api.syncAppleHealth('user-a', 7);
  const day = (h) => h.rpc[0][1].p_metrics.find((m) => m.metric_type === 'active_mins' && m.value > 0).recorded_at;
  const expected = (tz) => `${loadCore().dayKeyIn(tz, Date.now() - 60 * 60_000)}T00:00:00.000Z`;
  assert.equal(day(london), expected('Europe/London'));
  assert.equal(day(karachi), expected('Asia/Karachi'));
});

test('wiring: logout/account switch invalidate syncs; hooks ignore stale results; Health Connect mirrors the rules', () => {
  const auth = read('contexts/AuthContext.tsx');
  assert.match(auth, /setOnboarding\(null\);\s*\/\/ Discard any native health read[^\n]*\n\s*invalidateHealthSyncs\(\);/);
  assert.match(auth, /setPendingEnrollment\(null\);\s*invalidateHealthSyncs\(\);/);
  for (const hook of ['hooks/useAppleHealth.ts', 'hooks/useHealthConnect.ts']) {
    const src = read(hook);
    assert.ok((src.match(/owner\.current !== userId/g) ?? []).length >= 4, hook);
    assert.match(src, /const disconnect = useCallback/);
  }
  const hc = read('lib/healthConnect.ts');
  assert.doesNotMatch(hc, /RestingHeartRate|resting_hr/);
  assert.match(hc, /aggregateGroupByDuration\(\{\s*recordType: 'Steps'/);
  assert.match(hc, /readAllRecords\(healthConnect, 'ExerciseSession'/);
  assert.match(hc, /reconcileMetric\('active_mins', exercise, windowDays, true\)/, 'Health Connect confirms permission, so empty reads are genuine zeros');
  assert.match(hc, /await guard\.assertCurrent\(\);\s*const \{ data, error \} = await supabase\.rpc\('upsert_health_connect_daily_data'/);
  const screen = read('screens/subscreens/HealthPermissionsScreen.tsx');
  assert.match(screen, /'Apple Health linked'/);
  assert.match(screen, /no Apple Health data was readable/);
  assert.match(screen, /Disconnected\. Dad Health has stopped importing\./);
  assert.doesNotMatch(screen, /Resting heart rate/);
});
