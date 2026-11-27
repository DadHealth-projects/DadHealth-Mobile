import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = file => ts.transpileModule(readFileSync(new URL('../lib/' + file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness() {
  const core = {};
  vm.runInNewContext(compile('healthSyncCore.ts'), { exports: core });
  const h = { owner: 'a', token: 'fixture-a', calls: [] };
  const exports = {};
  vm.runInNewContext(compile('healthTransport.ts'), {
    exports, Headers, AbortController, process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://fixture.invalid', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public' } },
    fetch: async (url, init) => {
      h.calls.push({ authorization: init.headers.get('Authorization'), signal: init.signal });
      if (h.wait) return h.wait(init.signal);
      return new Response('{}');
    },
    require: name => ({
      './healthSyncCore': core,
      './supabase': { supabase: { auth: { getSession: async () => ({ data: { session: h.owner ? { user: { id: h.owner }, access_token: h.token } : null } }) } } },
      '@supabase/supabase-js': { createClient: (_url, _key, options) => { h.options = options; return { send: options.global.fetch }; } },
    })[name],
  });
  return { h, core, api: exports };
}
test('transport pins owner token even when supplied headers contain another session', async () => {
  const { h, api } = harness();
  const { client } = await api.healthTransport('a');
  h.token = 'fixture-rotated';
  await client.send('https://fixture.invalid', { headers: { Authorization: 'Bearer fixture-other' } });
  assert.equal(h.calls[0].authorization, 'Bearer fixture-a');
  assert.equal(h.options.auth.persistSession, false);
  assert.equal(h.options.auth.autoRefreshToken, false);
});
test('transport rejects changed owner before network handoff', async () => {
  const { h, api } = harness();
  const { client } = await api.healthTransport('a');
  h.owner = 'b';
  await assert.rejects(client.send('https://fixture.invalid'), e => e.name === 'StaleHealthSyncError');
  assert.equal(h.calls.length, 0);
});
test('logout/disconnect invalidation aborts in-flight network and stays stale after A/B/A', async () => {
  const { h, core, api } = harness();
  const { client } = await api.healthTransport('a');
  let started;
  const sent = new Promise(resolve => { started = resolve; });
  h.wait = signal => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
    started();
  });
  const pending = client.send('https://fixture.invalid');
  await sent;
  core.invalidateHealthSyncs();
  await assert.rejects(pending, /aborted/);
  await assert.rejects(client.send('https://fixture.invalid'), e => e.name === 'StaleHealthSyncError');
  assert.equal(h.calls.length, 1);
});
test('transport rejects missing or foreign initial session without creating client', async () => {
  const { h, api } = harness();
  h.owner = null;
  await assert.rejects(api.healthTransport('a'), e => e.name === 'StaleHealthSyncError');
  h.owner = 'b';
  await assert.rejects(api.healthTransport('a'), e => e.name === 'StaleHealthSyncError');
  assert.equal(h.options, undefined);
});
