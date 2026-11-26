import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Mind Plan reliability (2026-11-26): plan reads get one quick automatic retry after a
// temporary failure; writes are never repeated automatically.
function load() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/mindPlan.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Set, Promise, Date, JSON, setTimeout, clearTimeout, AbortController, TypeError, SyntaxError, Error, process,
    require: (id) => ({ './supabase': { supabase: {} } })[id],
  });
  return exports;
}
const api = load();
const available = { state: 'available', plan: { id: 'p' } };
function fake(results) {
  const calls = [];
  return { calls, fn: async (owner, op) => { calls.push([owner, op]); const next = results.shift(); if (next instanceof Error) throw next; return next; } };
}
const clock = (...times) => () => times.length > 1 ? times.shift() : times[0];
const signal = () => new AbortController().signal;

test('a quick "unavailable" answer or network failure is retried once and the plan loads', async () => {
  for (const first of [{ state: 'unavailable' }, new TypeError('Network request failed'), new SyntaxError('Unexpected token <')]) {
    const f = fake([first, available]);
    const result = await api.requestMindPlanWithRetry('a', null, signal(), f.fn, clock(0, 900));
    assert.equal(result.state, 'available', String(first.state ?? first.name));
    assert.equal(f.calls.length, 2);
    assert.deepEqual(f.calls.map(c => c[1]), [null, null]);
  }
});

test('never more than one retry; the second answer is reported as it is', async () => {
  const f = fake([{ state: 'unavailable' }, { state: 'unavailable' }, available]);
  assert.equal((await api.requestMindPlanWithRetry('a', null, signal(), f.fn, clock(0, 100))).state, 'unavailable');
  assert.equal(f.calls.length, 2);
  const g = fake([new TypeError('net'), new TypeError('net again')]);
  await assert.rejects(api.requestMindPlanWithRetry('a', null, signal(), g.fn, clock(0, 100)), /net again/);
  assert.equal(g.calls.length, 2);
});

test('start and complete are never repeated automatically', async () => {
  for (const op of [{ kind: 'start' }, { kind: 'complete', planId: 'p', actionNumber: 1 }]) {
    const f = fake([{ state: 'unavailable' }]);
    assert.equal((await api.requestMindPlanWithRetry('a', op, signal(), f.fn, clock(0, 100))).state, 'unavailable');
    const g = fake([new TypeError('lost response')]);
    await assert.rejects(api.requestMindPlanWithRetry('a', op, signal(), g.fn, clock(0, 100)));
    assert.equal(f.calls.length + g.calls.length, 2, op.kind);
  }
});

test('answers and failures that a retry cannot fix are returned at once', async () => {
  for (const state of ['locked', 'not_started', 'unauthorized', 'conflict']) {
    const f = fake([{ state }, available]);
    assert.equal((await api.requestMindPlanWithRetry('a', null, signal(), f.fn, clock(0, 10))).state, state);
    assert.equal(f.calls.length, 1, state);
  }
  for (const message of ['Account changed', 'Plan unavailable', 'Invalid plan']) {
    const f = fake([new Error(message), available]);
    await assert.rejects(api.requestMindPlanWithRetry('a', null, signal(), f.fn, clock(0, 10)), new RegExp(message));
    assert.equal(f.calls.length, 1, message);
  }
});

test('a slow failure is not repeated, so the wait stays bounded', async () => {
  const f = fake([{ state: 'unavailable' }, available]);
  const result = await api.requestMindPlanWithRetry('a', null, signal(), f.fn, clock(0, api.PLAN_RETRY_FAST_FAILURE_MS));
  assert.equal(result.state, 'unavailable'); assert.equal(f.calls.length, 1);
  assert.equal(api.PLAN_RETRY_FAST_FAILURE_MS, 8000); assert.equal(api.PLAN_RETRY_DELAY_MS, 1000);
});

test('an abort (account change, invalidate, dispose) before or during the pause stops the retry', async () => {
  const before = new AbortController(); before.abort();
  const f = fake([{ state: 'unavailable' }, available]);
  assert.equal((await api.requestMindPlanWithRetry('a', null, before.signal, f.fn, clock(0, 10))).state, 'unavailable');
  assert.equal(f.calls.length, 1);
  const during = new AbortController();
  const g = fake([{ state: 'unavailable' }, available]);
  const pending = api.requestMindPlanWithRetry('a', null, during.signal, g.fn, clock(0, 10));
  await new Promise(r => setTimeout(r, 20)); during.abort();
  assert.equal((await pending).state, 'unavailable'); assert.equal(g.calls.length, 1);
});

test('the Mind Plan hook uses the retrying read', () => {
  const hook = readFileSync(new URL('../hooks/useMindPlan.ts', import.meta.url), 'utf8');
  assert.match(hook, /createMindPlanController\(owner, requestMindPlanWithRetry,/);
});
