import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Client audit A3: a cancellation reason that could not be saved before the 50% offer is queued
// durably (per account) and replayed with the SAME request id, which the server keeps once.
function load(path, mocks, extras = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, Error, Promise, setTimeout, require: (id) => { assert.ok(id in mocks, id); return mocks[id]; }, ...extras });
  return exports;
}
function world({ sessionUser = 'A' } = {}) {
  const w = { queue: new Map(), events: [], saved: new Map(), calls: [], failNext: null, sessionUser, failed: [] };
  const storage = {
    allowPrivateOfflineUser() {}, blockPrivateOfflineUser() {}, clearPrivateOfflineData: async () => {},
    emitOfflineSync: (event) => w.events.push(event),
    enqueueOfflineWrite: async (item) => { w.queue.set(item.id, item); },
    readOfflineQueue: async (userId) => [...w.queue.values()].filter((item) => item.userId === userId),
    removeOfflineQueueItem: async (_userId, id) => { w.queue.delete(id); },
    markOfflineQueueItemFailed: async (_u, id, message) => { w.failed.push(id); w.queue.set(id, { ...w.queue.get(id), failedMessage: message }); },
    markJournalEntryFailed: async () => {}, markJournalEntrySynced: async () => {},
  };
  const supabase = { auth: { getSession: async () => ({ data: { session: w.sessionUser ? { user: { id: w.sessionUser } } : null }, error: null }) },
    rpc: async () => { throw new Error('unused'); }, from: () => { throw new Error('unused'); } };
  // Server rule (save_subscription_cancellation_feedback): keyed by (owner, request id); a replay is a no-op.
  const native = { saveCancellationFeedback: async (owner, input) => {
    w.calls.push([owner, input]);
    if (w.failNext) { const e = w.failNext; w.failNext = null; throw e; }
    if (!w.saved.has(`${owner}:${input.id}`)) w.saved.set(`${owner}:${input.id}`, input);
  } };
  const sync = load('lib/offlineSync.ts', { './supabase': { supabase }, './offlineStorage': storage, './nativeSubscriptions': native,
    './analyticsOccurrence': { occurrenceHeader: () => 'none' },
    './mindResetPendingStore': { readHeldMindResets: async () => ({ ok: true, items: [] }), updateHeldMindResets: async () => ({ ok: true, storedIds: new Set(), notStoredIds: new Set() }), clearHeldMindResets: async () => {} } });
  sync.setOfflineSyncUser('A');
  return { w, sync };
}
const item = (over = {}) => ({ id: 'req-1', userId: 'A', kind: 'cancellation_feedback', createdAt: '2026-11-27T10:00:00Z',
  payload: { subscriptionId: 'sub-1', reason: 'too_expensive', details: 'private words' }, ...over });

test('a queued reason is replayed once with the same request id, then removed', async () => {
  const { w, sync } = world();
  w.queue.set('req-1', item());
  await sync.syncOfflineQueue('A');
  assert.equal(w.calls.length, 1);
  assert.equal(JSON.stringify(w.calls[0]), JSON.stringify(['A', { id: 'req-1', subscriptionId: 'sub-1', reason: 'too_expensive', details: 'private words' }]));
  assert.equal(w.queue.size, 0);
  assert.equal(w.saved.size, 1);
  assert.ok(w.events.some(e => e.kind === 'cancellation_feedback' && e.status === 'synced'));
});

test('a network or server failure keeps it queued; the next sync saves it once', async () => {
  const { w, sync } = world();
  w.queue.set('req-1', item());
  w.failNext = new TypeError('Network request failed');
  await sync.syncOfflineQueue('A');
  assert.equal(w.queue.size, 1); assert.equal(w.saved.size, 0); assert.equal(w.failed.length, 0);
  await sync.syncOfflineQueue('A');
  assert.equal(w.queue.size, 0); assert.equal(w.saved.size, 1);
});

test('an invalid reason is marked failed honestly, never retried forever', async () => {
  const { w, sync } = world();
  w.queue.set('req-1', item());
  w.failNext = Object.assign(new Error('Please use at most 1,000 characters.'), { code: 'invalid_feedback' });
  await sync.syncOfflineQueue('A');
  assert.deepEqual(w.failed, ['req-1']); assert.equal(w.saved.size, 0);
  await sync.syncOfflineQueue('A');
  assert.equal(w.calls.length, 1, 'failed items are not resent');
});

test('another account never sends or sees this account\'s queued reason', async () => {
  const { w, sync } = world({ sessionUser: 'B' });
  w.queue.set('req-1', item());
  sync.setOfflineSyncUser('B');
  await sync.syncOfflineQueue('B');
  assert.equal(w.calls.length, 0); assert.equal(w.queue.size, 1);
  await sync.syncOfflineQueue('A');
  assert.equal(w.calls.length, 0, 'A is not the active account');
});

test('the offer path queues a failed reason save durably and never marks it saved', () => {
  const ui = readFileSync('components/subscriptions/CancellationFlow.tsx', 'utf8').replace(/\r\n/g, '\n');
  const accept = ui.slice(ui.indexOf('const acceptOffer'), ui.indexOf('const handoff'));
  assert.ok(accept.indexOf('enqueueOfflineWrite') > accept.indexOf('saveCancellationFeedback'));
  assert.ok(accept.indexOf('enqueueOfflineWrite') < accept.indexOf('await redeemOffer(offer)'), 'queued before redeeming');
  assert.match(accept, /kind: 'cancellation_feedback'/);
  assert.match(accept, /\{ id: pending\.id, userId: owner,/, 'same request id, this account');
});
