import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Weekly report reliability (2026-11-26): one quick automatic retry for temporary failures only.
class Item02ReadError extends Error { constructor(reason) { super('Information unavailable'); this.reason = reason; } }
function loadHook() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../hooks/useWeeklyReport.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Set, Promise, Date, setTimeout, clearTimeout, AbortController,
    require: (id) => ({
      '../lib/supabase': { supabase: {} }, react: {}, 'react-native': { AppState: {} },
      '../contexts/NetworkContext': {}, '../lib/offlineStorage': {},
      '../lib/weeklyReport': { Item02ReadError, parseSavedReport: (v) => v },
    })[id],
  });
  return exports;
}
const hook = loadHook();
function fakeFetch(results) {
  const calls = [];
  return { calls, fn: async (owner, path) => { calls.push([owner, path]); const next = results.shift(); if (next instanceof Error) throw next; return next; } };
}
const fixedClock = (...times) => () => times.length > 1 ? times.shift() : times[0];

test('a quick temporary failure is retried once and the report loads', async () => {
  for (const reason of ['read_failed', 'entitlement_unavailable']) {
    const f = fakeFetch([new Item02ReadError(reason), { state: 'available' }]);
    const result = await hook.fetchItem02WithRetry('owner-a', '/api/reports/weekly', new AbortController().signal, () => true, f.fn, fixedClock(0, 900));
    assert.deepEqual(result, { state: 'available' }); assert.equal(f.calls.length, 2, reason);
  }
  const net = fakeFetch([new TypeError('Network request failed'), { state: 'available' }]);
  assert.deepEqual(await hook.fetchItem02WithRetry('owner-a', '/p', new AbortController().signal, () => true, net.fn, fixedClock(0, 300)), { state: 'available' });
});

test('never more than one retry: a second failure is reported honestly', async () => {
  const f = fakeFetch([new Item02ReadError('read_failed'), new Item02ReadError('read_failed'), { state: 'available' }]);
  await assert.rejects(hook.fetchItem02WithRetry('owner-a', '/p', new AbortController().signal, () => true, f.fn, fixedClock(0, 500)), (e) => e.reason === 'read_failed');
  assert.equal(f.calls.length, 2);
});

test('missing / unreleased reports, sign-in, account and invalid snapshots are never retried', async () => {
  for (const reason of ['snapshot_missing', 'not_released', 'authorization_unavailable', 'account_changed', 'invalid_snapshot', 'cancelled']) {
    const f = fakeFetch([new Item02ReadError(reason), { state: 'available' }]);
    await assert.rejects(hook.fetchItem02WithRetry('owner-a', '/p', new AbortController().signal, () => true, f.fn, fixedClock(0, 100)), (e) => e.reason === reason);
    assert.equal(f.calls.length, 1, reason);
  }
});

test('a slow failure (timeout territory) is not repeated, so the wait never doubles', async () => {
  const f = fakeFetch([new Item02ReadError('read_failed'), { state: 'available' }]);
  await assert.rejects(hook.fetchItem02WithRetry('owner-a', '/p', new AbortController().signal, () => true, f.fn, fixedClock(0, hook.ITEM02_RETRY_FAST_FAILURE_MS)));
  assert.equal(f.calls.length, 1);
});

test('account switch or cancellation during the retry delay sends nothing more', async () => {
  const aborted = new AbortController();
  const f = fakeFetch([new Item02ReadError('read_failed'), { state: 'available' }]);
  const pending = hook.fetchItem02WithRetry('owner-a', '/p', aborted.signal, () => true, f.fn, fixedClock(0, 100));
  setTimeout(() => aborted.abort(), 10);
  await assert.rejects(pending); assert.equal(f.calls.length, 1, 'abort');
  let valid = true;
  const g = fakeFetch([new Item02ReadError('read_failed'), { state: 'available' }]);
  const second = hook.fetchItem02WithRetry('owner-a', '/p', new AbortController().signal, () => valid, g.fn, fixedClock(0, 100));
  setTimeout(() => { valid = false; }, 10);
  await assert.rejects(second); assert.equal(g.calls.length, 1, 'account changed (stale generation)');
});

test('the hook uses the bounded retry and keeps the 15 s per-request limit', () => {
  const src = readFileSync(new URL('../hooks/useWeeklyReport.ts', import.meta.url), 'utf8');
  assert.match(src, /const payload = await fetchItem02WithRetry\(owner, path, request\.signal, valid\);/);
  assert.match(src, /reject\(new Item02ReadError\('read_failed'\)\); \}, 15000\)/, 'timeout unchanged');
});
