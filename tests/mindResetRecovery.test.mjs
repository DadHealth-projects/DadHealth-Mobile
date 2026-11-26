import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Phase 5: a finished Mind Reset must never be silently lost when local saving fails, and
// retries must never credit twice. Behavioural harness around the real offlineSync and
// mindResetCompletion modules with fake storage and a fake idempotent server.
function load(path, mocks, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, Error, Promise, setTimeout, require: (id) => { assert.ok(id in mocks, id); return mocks[id]; }, ...extras });
  return exports;
}

function world({ storageFails = false, serverDown = false, sessionUser = 'A' } = {}) {
  const w = { queue: new Map(), events: [], server: new Map(), rpcCalls: 0, storageFails, serverDown, sessionUser };
  const storage = {
    allowPrivateOfflineUser() {}, blockPrivateOfflineUser() {}, clearPrivateOfflineData: async () => {},
    emitOfflineSync: (event) => w.events.push(event),
    enqueueOfflineWrite: async (item) => { if (w.storageFails) throw new Error('disk full'); w.queue.set(item.id, item); },
    readOfflineQueue: async (userId) => [...w.queue.values()].filter((item) => item.userId === userId),
    removeOfflineQueueItem: async (_userId, id) => { w.queue.delete(id); },
    markOfflineQueueItemFailed: async () => {}, markJournalEntryFailed: async () => {}, markJournalEntrySynced: async () => {},
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: w.sessionUser ? { user: { id: w.sessionUser } } : null }, error: null }) },
    rpc: async (name, args) => {
      assert.equal(name, 'complete_mind_reset');
      w.rpcCalls++;
      if (w.serverDown) return { data: null, error: { message: 'Network request failed' } };
      // Server rule (complete_mind_reset): a known id is a no-op, so credit is per id.
      if (!w.server.has(args.p_id)) w.server.set(args.p_id, { owner: w.sessionUser, seconds: args.p_active_seconds });
      return { data: null, error: null };
    },
    from: () => { throw new Error('unused'); },
  };
  const sync = load('lib/offlineSync.ts', { './supabase': { supabase }, './offlineStorage': storage, './analyticsOccurrence': { occurrenceHeader: () => 'none' } });
  let id = 0;
  const completion = load('lib/mindResetCompletion.ts', {
    'expo-crypto': { randomUUID: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` },
    './offlineStorage': storage, './offlineSync': sync,
  });
  sync.setOfflineSyncUser('A');
  return { w, sync, completion };
}
const credits = (w, owner = 'A') => [...w.server.values()].filter((row) => row.owner === owner).length;

test('normal completion: queued durably, sent once, removed from the queue', async () => {
  const { w, completion } = world();
  await completion.recordMindResetCompletion('A', 120);
  assert.equal(credits(w), 1);
  assert.equal(w.queue.size, 0);
  assert.ok(w.events.some((e) => e.kind === 'mind_reset_complete' && e.status === 'synced'));
});

test('local storage failure: sent straight to the server instead of being dropped', async () => {
  const { w, sync, completion } = world({ storageFails: true });
  await completion.recordMindResetCompletion('A', 90);
  assert.equal(credits(w), 1, 'credit not lost');
  assert.equal(sync.pendingMindResetCount('A'), 0);
  assert.ok(!w.events.some((e) => e.status === 'failed'), 'no failure reported once the server confirmed');
});

test('storage and network both fail: honest failure, held for retry, then credited once', async () => {
  const { w, sync, completion } = world({ storageFails: true, serverDown: true });
  await completion.recordMindResetCompletion('A', 200);
  assert.equal(credits(w), 0);
  assert.equal(sync.pendingMindResetCount('A'), 1, 'held, not discarded');
  const failure = w.events.find((e) => e.kind === 'mind_reset_complete' && e.status === 'failed');
  assert.equal(failure?.message, sync.MIND_RESET_SAVE_FAILED, 'the screen gets an honest message');
  w.serverDown = false;
  await sync.syncOfflineQueue('A');
  await sync.syncOfflineQueue('A');
  assert.equal(credits(w), 1, 'retry credits exactly once');
  assert.equal(sync.pendingMindResetCount('A'), 0);
});

test('storage recovers before the network: moved back into the durable queue, which survives a restart', async () => {
  const { w, sync, completion } = world({ storageFails: true, serverDown: true });
  await completion.recordMindResetCompletion('A', 150);
  w.storageFails = false;
  await sync.syncOfflineQueue('A');
  assert.equal(sync.pendingMindResetCount('A'), 0, 'no longer memory-only');
  assert.equal(w.queue.size, 1, 'durable queue now holds it (app restart safe)');
  w.serverDown = false;
  await sync.syncOfflineQueue('A');
  assert.equal(credits(w), 1);
  assert.equal(w.queue.size, 0);
});

test('duplicate submission of the same completion never credits twice', async () => {
  const { w, sync } = world();
  const item = sync.createMindResetQueueItem('A', '00000000-0000-4000-8000-0000000000ff', 100);
  await sync.persistMindReset(item);
  await sync.persistMindReset(item);
  sync.holdPendingMindReset(item); sync.holdPendingMindReset(item);
  assert.equal(sync.pendingMindResetCount('A'), 1, 'held once per id');
  await sync.syncOfflineQueue('A');
  assert.equal(credits(w), 1);
});

test('logout and account switch: held completions are dropped and never sent under another account', async () => {
  const { w, sync, completion } = world({ storageFails: true, serverDown: true });
  await completion.recordMindResetCompletion('A', 120);
  assert.equal(sync.pendingMindResetCount('A'), 1);
  // Switch to B: A's item must not be sent with B's session.
  w.serverDown = false; w.sessionUser = 'B'; sync.setOfflineSyncUser('B');
  await sync.syncOfflineQueue('B');
  assert.equal(credits(w, 'B'), 0, "A's completion never credited to B");
  await sync.pauseAndClearOfflineUser('A');
  assert.equal(sync.pendingMindResetCount('A'), 0, 'sign-out clears it');
});

test('the Mind Reset screen shows the honest save problem only for this account and clears it when saved', () => {
  const ui = readFileSync('screens/subscreens/BreathingSessionScreen.tsx', 'utf8');
  assert.match(ui, /if \(event\.userId !== user\?\.id \|\| event\.kind !== 'mind_reset_complete'\) return;/);
  assert.match(ui, /if \(event\.status === 'failed'\) setSaveProblem\(event\.message \?\? null\);/);
  assert.match(ui, /if \(event\.status === 'synced' \|\| event\.status === 'cleared'\) setSaveProblem\(null\);/);
  assert.match(ui, /\{saveProblem \? <Text accessibilityRole="alert"/);
  assert.doesNotMatch(ui, /saved to your Mind score|counted toward/i, 'never claims credit before the server confirms');
});
