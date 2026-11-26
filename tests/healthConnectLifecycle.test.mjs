import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = file => ts.transpileModule(readFileSync(new URL('../lib/' + file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness({ revoked = false, fails = false, partial = false } = {}) {
  const core = {}, exports = {}, calls = [];
  vm.runInNewContext(compile('healthSyncCore.ts'), { exports: core });
  let checks = 0;
  const native = {
    SdkAvailabilityStatus: { SDK_AVAILABLE: 3 }, getSdkStatus: async () => 3, initialize: async () => true,
    getGrantedPermissions: async () => (++checks > 1 && revoked ? [] : partial ? ['Steps'] : ['Steps', 'ExerciseSession', 'SleepSession']).map(recordType => ({ recordType, accessType: 'read' })),
    aggregateGroupByDuration: async () => { if (fails) throw new Error('native failure'); return []; },
    readRecords: async () => ({ records: [] }),
  };
  const client = {
    from: table => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'user_profile' ? { timezone: 'Europe/London' } : { id: 'fixture-link' }, error: null }) }; return q; },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: { synced_at: args.p_complete ? '2026-11-26T12:00:00Z' : null }, error: null }; },
  };
  vm.runInNewContext(compile('healthConnect.ts'), { exports, require: name => ({
    'react-native': { Platform: { OS: 'android' }, NativeModules: {}, TurboModuleRegistry: { get: () => ({}) } },
    'react-native-health-connect': native,
    './healthSyncCore': core,
    './healthTransport': { healthTransport: async () => ({ client, guard: core.createHealthSyncGuard('a', async () => 'a') }) },
    './supabase': { supabase: client },
    './dashboardFreshness': { markDashboardStale() {} },
    './healthRefreshWindow': { nextRefreshDays: async () => 7, markRefreshCompleted: async () => {} },
  })[name] ?? assert.fail(name) });
  return { api: exports, calls };
}
test('permission withdrawal during read prevents upload and last-success stamp', async () => {
  const h = harness({ revoked: true });
  await assert.rejects(h.api.syncHealthConnect('a'), e => e.code === 'permission_denied');
  assert.equal(h.calls.length, 0);
});
test('partial grant uploads only permitted totals and uses server success timestamp', async () => {
  const h = harness({ partial: true });
  const result = await h.api.syncHealthConnect('a');
  assert.ok(h.calls[0].args.p_metrics.length > 0);
  assert.ok(h.calls[0].args.p_metrics.every(m => m.metric_type === 'steps'));
  assert.equal(h.calls[0].args.p_sleep.length, 0);
  assert.equal(result.syncedAt, '2026-11-26T12:00:00Z');
});
test('partial provider failure preserves successful types without stamping a full sync', async () => {
  const h = harness({ fails: true });
  await assert.rejects(h.api.syncHealthConnect('a'), /health_read_incomplete/);
  assert.equal(h.calls[0].args.p_complete, false);
  assert.ok(h.calls[0].args.p_metrics.every(m => m.metric_type === 'active_mins'));
});
