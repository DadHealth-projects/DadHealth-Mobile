import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/locationDeadline.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function setup() {
  const exports = {};
  let expire;
  let cleared = false;
  new Function('exports', 'setTimeout', 'clearTimeout', js)(exports,
    callback => { expire = callback; return 1; }, () => { cleared = true; });
  return { run: exports.withLocationDeadline, expire: () => expire(), cleared: () => cleared };
}

test('native lookup that never responds rejects and releases its deadline', async () => {
  const h = setup();
  const request = h.run(new Promise(() => {}));
  h.expire();
  await assert.rejects(request, /location_timeout/);
  assert.equal(h.cleared(), true);
});

test('successful location and permission results pass through unchanged', async () => {
  const h = setup();
  const result = { coords: { latitude: 51, longitude: -1 } };
  assert.equal(await h.run(Promise.resolve(result)), result);
  assert.equal(h.cleared(), true);
});

test('native rejection is preserved and clears the deadline', async () => {
  const h = setup();
  await assert.rejects(h.run(Promise.reject(new Error('permission denied'))), /permission denied/);
  assert.equal(h.cleared(), true);
});
