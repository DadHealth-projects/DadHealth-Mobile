import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/proInsights.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const session = { data: { session: { access_token: 'test-token' } }, error: null };
const pending = () => new Promise(() => {});

function setup(getSession, fetch) {
  const exports = {};
  let expire;
  let cleared = false;
  new Function('require', 'exports', 'process', 'fetch', 'setTimeout', 'clearTimeout', js)(
    () => ({ supabase: { auth: { getSession } } }), exports, { env: {} }, fetch,
    callback => { expire = callback; return 1; }, () => { cleared = true; },
  );
  return { request: () => exports.fetchProInsight('manual-activity-trends'), expire: () => expire(), cleared: () => cleared };
}

for (const stage of ['session', 'network', 'body']) {
  test(`stalled ${stage} stops loading at the deadline`, async () => {
    let signal;
    const harness = setup(stage === 'session' ? pending : async () => session, (_url, init) => {
      signal = init.signal;
      return stage === 'network' ? pending() : Promise.resolve({ ok: true, json: pending });
    });
    const request = harness.request();
    await new Promise(resolve => setImmediate(resolve));
    harness.expire();
    await assert.rejects(request, /timed out/);
    assert.equal(harness.cleared(), true);
    if (signal) assert.equal(signal.aborted, true);
  });
}

test('successful trends return their actual points and clear the deadline', async () => {
  const payload = { points: [{ week_start: '2026-09-28', bond_manual_points: 10 }] };
  const harness = setup(async () => session, async () => ({ ok: true, json: async () => payload }));
  assert.deepEqual(await harness.request(), payload);
  assert.equal(harness.cleared(), true);
});

test('invalid successful response rejects instead of passing null to a chart', async () => {
  const harness = setup(async () => session, async () => ({ ok: true, json: async () => null }));
  await assert.rejects(harness.request(), /unavailable/);
});
