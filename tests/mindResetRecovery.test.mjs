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

function world({ storageFails = false, serverDown = false, sessionUser = 'A', keychainFails = false, keychain = new Map(), server = new Map() } = {}) {
  const w = { queue: new Map(), events: [], server, rpcCalls: 0, storageFails, serverDown, sessionUser, keychain, keychainFails };
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
  const secure = {
    getItemAsync: async (k) => { if (w.keychainFails || w.keychainReadFails) throw new Error('keychain locked'); if (w.beforeKeychainRead) await w.beforeKeychainRead(); return w.keychain.get(k) ?? null; },
    setItemAsync: async (k, v) => { if (w.keychainFails) throw new Error('keychain locked'); if (w.beforeKeychainWrite) await w.beforeKeychainWrite(); w.keychain.set(k, v); },
    deleteItemAsync: async (k) => { if (w.keychainFails || w.keychainDeleteFails) throw new Error('keychain locked'); w.keychain.delete(k); },
  };
  const pendingStore = load('lib/mindResetPendingStore.ts', { 'expo-secure-store': secure }, { JSON, Array, Number, Map, Set, Math, Date, Promise });
  const sync = load('lib/offlineSync.ts', { './supabase': { supabase }, './offlineStorage': storage, './nativeSubscriptions': { saveCancellationFeedback: async () => { throw new Error('unexpected feedback send'); } }, './analyticsOccurrence': { occurrenceHeader: () => 'none' },
    './mindResetPendingStore': pendingStore });
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
  assert.equal(failure?.message, sync.MIND_RESET_SAVE_DELAYED, 'honest message: kept on this phone, not yet sent');
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
  await sync.holdPendingMindReset(item); await sync.holdPendingMindReset(item);
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

test('app restart: a completion the queue could not store is recovered from the keychain and credited once', async () => {
  const first = world({ storageFails: true, serverDown: true });
  await first.completion.recordMindResetCompletion('A', 180);
  assert.equal(credits(first.w), 0);
  assert.equal(first.w.keychain.size, 1, 'saved durably outside the failed queue');
  // Process killed: memory gone. Relaunch with the same keychain and server, network back.
  const second = world({ storageFails: true, serverDown: false, keychain: first.w.keychain, server: first.w.server });
  assert.equal(second.sync.pendingMindResetCount('A'), 0, 'fresh process starts with empty memory');
  await second.sync.syncOfflineQueue('A');
  assert.equal(credits(second.w), 1, 'credit recovered after restart');
  assert.equal(second.w.keychain.size, 0, 'cleared once the server confirmed');
  await second.sync.syncOfflineQueue('A');
  assert.equal(credits(second.w), 1, 'never credited twice');
});

test('queue AND keychain unavailable: memory only, and the message says so (not guaranteed across restart)', async () => {
  const { w, sync, completion } = world({ storageFails: true, serverDown: true, keychainFails: true });
  await completion.recordMindResetCompletion('A', 120);
  assert.equal(sync.pendingMindResetCount('A'), 1);
  const failure = w.events.find((e) => e.kind === 'mind_reset_complete' && e.status === 'failed');
  assert.equal(failure?.message, sync.MIND_RESET_SAVE_FAILED, '"keep trying while Dad Health is open" - no false durability claim');
});

test('sign-out clears the keychain copy too', async () => {
  const { w, sync, completion } = world({ storageFails: true, serverDown: true });
  await completion.recordMindResetCompletion('A', 120);
  assert.equal(w.keychain.size, 1);
  await sync.pauseAndClearOfflineUser('A');
  assert.equal(w.keychain.size, 0);
});

// Client audit A4 (26 Nov): edge cases of the keychain fallback.
const heldIds = (w) => [...new Set(
  [...w.keychain.values()].flatMap(raw =>
    JSON.parse(raw).map(item => item.id)
  )
)];

test('all nine held completions remain durable', async () => {
  const { w, sync } = world({
    storageFails: true,
    serverDown: true,
  });

  for (let i = 1; i <= 9; i++) {
    const item = sync.createMindResetQueueItem(
      'A',
      '00000000-0000-4000-8000-00000000000' + i,
      60 + i,
      '2026-11-26T12:00:00Z'
    );

    assert.equal(await sync.holdPendingMindReset(item), true);
  }

  assert.equal(heldIds(w).length, 9);
  assert.equal(sync.pendingMindResetCount('A'), 9);

  await sync.syncOfflineQueue('A');

  const last = w.events.filter(
    e => e.kind === 'mind_reset_complete' &&
         e.status === 'failed'
  ).at(-1);

  assert.equal(last?.message, sync.MIND_RESET_SAVE_DELAYED);

  w.serverDown = false;
  await sync.syncOfflineQueue('A');

  assert.equal(credits(w), 9);
  assert.equal(w.keychain.size, 0);
});

test('a failed keychain read never erases completions that are saved there', async () => {
  const first = world({ storageFails: true, serverDown: true });
  await first.completion.recordMindResetCompletion('A', 120);
  assert.equal(heldIds(first.w).length, 1);
  // Restart with an unreadable keychain: recovery must not overwrite the stored entry.
  const second = world({ storageFails: true, serverDown: true, keychain: first.w.keychain, server: first.w.server });
  second.w.keychainReadFails = true;
  await second.sync.syncOfflineQueue('A');
  assert.equal(heldIds(second.w).length, 1, 'still stored');
  assert.ok(second.w.events.some((e) => e.kind === 'mind_reset_complete' && e.status === 'failed'), 'unknown state is reported, not silent');
  second.w.keychainReadFails = false; second.w.serverDown = false;
  await second.sync.syncOfflineQueue('A');
  assert.equal(credits(second.w), 1);
});

test('a failed keychain delete makes sign-out cleanup fail loudly after finishing the other steps', async () => {
  const { w, sync, completion } = world({ storageFails: true, serverDown: true });
  await completion.recordMindResetCompletion('A', 120);
  w.keychainDeleteFails = true;
  await assert.rejects(sync.pauseAndClearOfflineUser('A'), /keychain locked/);
  assert.equal(sync.pendingMindResetCount('A'), 0, 'memory cleared regardless');
  assert.equal(w.keychain.size, 1, 'the entry remains, and the failure was reported rather than hidden');
});

test('a completion held while recovery is running is not overwritten by it', async () => {
  const { w, sync, completion } = world({ storageFails: true, serverDown: true });
  await completion.recordMindResetCompletion('A', 120);
  const late = sync.createMindResetQueueItem('A', '00000000-0000-4000-8000-0000000000ee', 200, '2026-11-26T12:00:00Z');
  // A real concurrent hold arrives while recovery is reading storage; it must queue behind the lock
  // (not wait inside it) and must survive recovery.
  let lateHold = null;
  w.beforeKeychainRead = async () => { if (!lateHold) lateHold = sync.holdPendingMindReset(late); };
  await sync.syncOfflineQueue('A');
  w.beforeKeychainRead = null;
  assert.equal(await lateHold, true, 'the late hold is stored durably after the recovery write');
  assert.ok(heldIds(w).includes(late.id), 'recovery did not overwrite it');
  w.serverDown = false;
  await sync.syncOfflineQueue('A');
  assert.equal(credits(w), 2, 'both completions credited, once each');
});

test('more than eight held completions survive restart without loss', async () => {
  const first = world({
    storageFails: true,
    serverDown: true,
  });

  for (let i = 0; i < 17; i++) {
    await first.completion.recordMindResetCompletion('A', 120);
  }

  assert.equal(first.sync.pendingMindResetCount('A'), 17);
  assert.equal(credits(first.w), 0);

  const second = world({
    storageFails: true,
    serverDown: false,
    keychain: first.w.keychain,
    server: first.w.server,
  });

  await second.sync.syncOfflineQueue('A');

  assert.equal(credits(second.w), 17);
  assert.equal(second.sync.pendingMindResetCount('A'), 0);
  assert.equal(second.w.keychain.size, 0);

  await second.sync.syncOfflineQueue('A');

  assert.equal(credits(second.w), 17);
});

test('concurrent held completions survive restart', async () => {
  const first = world({
    storageFails: true,
    serverDown: true,
  });

  await Promise.all(
    Array.from({ length: 12 }, () =>
      first.completion.recordMindResetCompletion('A', 120),
    ),
  );

  const second = world({
    storageFails: true,
    keychain: first.w.keychain,
    server: first.w.server,
  });

  await second.sync.syncOfflineQueue('A');

  assert.equal(credits(second.w), 12);
  assert.equal(second.w.keychain.size, 0);
});

test('sign-out clears every pending storage page', async () => {
  const { w, sync, completion } = world({
    storageFails: true,
    serverDown: true,
  });

  for (let i = 0; i < 17; i++) {
    await completion.recordMindResetCompletion('A', 120);
  }

  await sync.pauseAndClearOfflineUser('A');

  assert.equal(w.keychain.size, 0);
  assert.equal(sync.pendingMindResetCount('A'), 0);
});

test('a failed new page write preserves previously durable completions', async () => {
  const first = world({
    storageFails: true,
    serverDown: true,
  });

  for (let i = 0; i < 8; i++) {
    await first.completion.recordMindResetCompletion('A', 120);
  }

  assert.equal(heldIds(first.w).length, 8);

  first.w.beforeKeychainWrite = async () => {
    throw new Error('interrupted storage write');
  };

  await first.completion.recordMindResetCompletion('A', 120);

  assert.equal(heldIds(first.w).length, 8);

  const second = world({
    storageFails: true,
    serverDown: false,
    keychain: first.w.keychain,
    server: first.w.server,
  });

  await second.sync.syncOfflineQueue('A');

  assert.equal(credits(second.w), 8);
  assert.equal(second.w.keychain.size, 0);
});

test('interrupted sign-out cleanup leaves remaining pages discoverable', async () => {
  const { w, sync, completion } = world({
    storageFails: true,
    serverDown: true,
  });

  for (let i = 0; i < 17; i++) {
    await completion.recordMindResetCompletion('A', 120);
  }

  w.keychainDeleteFails = true;

  await assert.rejects(sync.pauseAndClearOfflineUser('A'));

  assert.equal(heldIds(w).length, 17);

  w.keychainDeleteFails = false;

  await sync.pauseAndClearOfflineUser('A');

  assert.equal(w.keychain.size, 0);
});
