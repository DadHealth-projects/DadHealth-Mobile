import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, Date, Number, Error, Math, Promise,
    require: (name) => { assert.ok(name in mocks, name); return mocks[name]; },
  });
  return exports;
}
const tick = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };

const { createResetPlayback } = load('lib/mindResetPlayback.ts');
const { createMindResetOwner, MIND_RESET_MIN_RECORD_SECONDS } = load('lib/mindResetOwner.ts', { './mindResetPlayback': { createResetPlayback } });

function ownerSetup() {
  const players = [], records = [];
  const owner = createMindResetOwner(() => {
    let callback;
    const p = { currentTime: 0, isLoaded: true, muted: false, loop: false, removed: false,
      currentStatus: { currentTime: 0, playing: false, isLoaded: true, didJustFinish: false },
      play() {}, pause() {}, remove() { this.removed = true; }, release() {}, async seekTo(t) { this.currentTime = t; },
      addListener(_, fn) { callback = fn; return { remove() {} }; },
      emit(time, playing = true, finished = false) { this.currentTime = time; this.currentStatus = { currentTime: time, playing, isLoaded: true, didJustFinish: finished }; callback(this.currentStatus); } };
    players.push(p); return p;
  }, async () => async () => {}, (seconds) => records.push(seconds));
  return { owner, players, records };
}

test('the scoring threshold is the agreed 60 seconds', () => {
  assert.equal(MIND_RESET_MIN_RECORD_SECONDS, 60);
});

test('"Finish here" after 60+ active seconds records once with the active time', async () => {
  const { owner, players, records } = ownerSetup();
  owner.start(); await tick(); players[0].emit(95);
  owner.end();
  assert.deepEqual(records, [95]);
  owner.dispose();
});

test('ending before 60 seconds records nothing', async () => {
  const { owner, players, records } = ownerSetup();
  owner.start(); await tick(); players[0].emit(59);
  owner.end();
  assert.deepEqual(records, []);
  owner.dispose();
});

test('a natural five-minute finish records 300 once, and "Done" does not record again', async () => {
  const { owner, players, records } = ownerSetup();
  owner.start(); await tick(); players[0].emit(300); players[0].emit(310, false, true);
  assert.deepEqual(records, [300]);
  owner.end();
  assert.deepEqual(records, [300]);
  owner.start(); await tick(); players[1].emit(120); owner.end();
  assert.deepEqual(records, [300, 120], 'a new run after end records separately');
  owner.dispose();
});

test('pause and resume record the true active position, not wall-clock time', async () => {
  const { owner, players, records } = ownerSetup();
  owner.start(); await tick(); players[0].emit(70); owner.pause();
  owner.start(); await tick(); players[1].emit(130); owner.end();
  assert.deepEqual(records, [130]);
  owner.dispose();
});

test('account teardown (dispose) records nothing for the old owner', async () => {
  const { owner, players, records } = ownerSetup();
  owner.start(); await tick(); players[0].emit(200);
  owner.dispose(); owner.end();
  assert.deepEqual(records, []);
});

function syncModule(rpcResult) {
  const calls = [];
  const supabase = { rpc: async (name, args) => { calls.push({ name, args }); return rpcResult(); } };
  const mod = load('lib/offlineSync.ts', {
    './analyticsOccurrence': { occurrenceHeader: () => ({}) },
    './supabase': { supabase },
    './offlineStorage': {},
    './mindResetPendingStore':{readHeldMindResets:async()=>[],writeHeldMindResets:async()=>true,clearHeldMindResets:async()=>{}},
  });
  return { mod, calls };
}
const NOW = Date.parse('2026-11-24T12:00:00Z');

test('sync calls the existing complete_mind_reset contract with the queue id', async () => {
  const { mod, calls } = syncModule(() => ({ error: null }));
  const item = mod.createMindResetQueueItem('user-a', 'session-1', 120, '2026-11-24T11:00:00Z');
  await mod.persistMindReset(item, NOW);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ name: 'complete_mind_reset', args: { p_id: 'session-1', p_completed_at: '2026-11-24T11:00:00Z', p_active_seconds: 120 } }]);
});

test('completions older than 8 days or outside 60–300 s are dropped without calling the server', async () => {
  const { mod, calls } = syncModule(() => ({ error: null }));
  await assert.rejects(mod.persistMindReset(mod.createMindResetQueueItem('u', 'a', 120, '2026-11-15T11:00:00Z'), NOW), /mind_reset_expired/);
  await assert.rejects(mod.persistMindReset(mod.createMindResetQueueItem('u', 'b', 59, '2026-11-24T11:00:00Z'), NOW), /invalid_mind_reset/);
  await assert.rejects(mod.persistMindReset(mod.createMindResetQueueItem('u', 'c', 301, '2026-11-24T11:00:00Z'), NOW), /invalid_mind_reset/);
  assert.equal(calls.length, 0);
});

test('a server rejection of a recent valid completion is retried later; other errors surface', async () => {
  const skew = syncModule(() => ({ error: { code: '22023', message: 'invalid_mind_reset' } }));
  await assert.rejects(skew.mod.persistMindReset(skew.mod.createMindResetQueueItem('u', 'a', 120, '2026-11-24T11:59:00Z'), NOW),
    (error) => error instanceof skew.mod.MindResetRetryLaterError);
  const owner = syncModule(() => ({ error: { code: '42501', message: 'mind_reset_owner_mismatch' } }));
  await assert.rejects(owner.mod.persistMindReset(owner.mod.createMindResetQueueItem('u', 'a', 120, '2026-11-24T11:00:00Z'), NOW),
    (error) => error.code === '42501');
});

test('queue, provider and dashboard are wired: dedupe by id, retry-later skips, score refresh after confirmation', () => {
  const storage = read('lib/offlineStorage.ts'), sync = read('lib/offlineSync.ts');
  const provider = read('contexts/MindResetContext.tsx'), dashboard = read('hooks/useDashboard.ts');
  assert.match(storage, /if \(item\.kind === 'mind_reset_complete'\) return existing\.id === item\.id;/);
  assert.match(sync, /else if \(item\.kind === 'mind_reset_complete'\) await persistMindReset\(item\);/);
  assert.match(sync, /if \(error instanceof MindResetRetryLaterError\) continue;/);
  assert.match(provider, /\(activeSeconds\) => \{ if \(owner\) void recordMindResetCompletion\(owner, activeSeconds\); \}/);
  assert.match(dashboard, /event\.kind === 'mind_reset_complete'\) && event\.status === 'synced'\) \{\s*void refreshDashboardForUser\(userId\);/);
  assert.match(read('lib/mindResetCompletion.ts'), /const item = createMindResetQueueItem\(userId, Crypto\.randomUUID\(\), activeSeconds\);\s*try \{\s*await enqueueOfflineWrite\(item\);\s*\} catch \{\s*await holdPendingMindReset\(item\);\s*\}\s*try \{\s*await syncOfflineQueue\(userId\);/, 'queued first; held (never dropped) when the device cannot store it; then synced');
});
