import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const config = require('../metro.config.js');
const { getAsset } = require('../node_modules/@expo/metro/node_modules/metro/src/Assets.js');
const rewrite = config.server.rewriteRequestUrl;

// Mirror Metro's pathname/query extraction, including RN's appended query.
function assetPath(request) {
  const url = new URL(request, 'http://localhost:8081');
  const pathname = url.pathname.split('/').map(decodeURIComponent).join('/');
  return pathname.match(/^\/assets\/(.+)$/)?.[1]
    ?? url.searchParams.get('unstable_path')?.split('?')[0];
}

test('reproduces encoded-directory ENOENT and serves both real logos after normalization', async () => {
  for (const name of ['02. DAD HEALTH LOGO_COLOR_Dark BG.png', 'DH LOGO_LimeWhite_DarkBG.png']) {
    const request = `/assets/?unstable_path=.%252Fassets/${encodeURIComponent(name)}?platform=ios&hash=test`;
    await assert.rejects(getAsset(assetPath(request), root, [], 'ios', ['png']), { code: 'ENOENT' });
    const bytes = await getAsset(assetPath(rewrite(request)), root, [], 'ios', ['png']);
    assert.deepEqual(bytes, await readFile(path.join(root, 'assets', name)));
  }
});

test('normalizes double-escaped pathname assets and preserves query parameters', async () => {
  const request = '/assets/.%252Fassets/DH%20LOGO_LimeWhite_DarkBG.png?platform=ios&hash=test';
  const result = rewrite(request);
  assert.equal(assetPath(result), 'assets/DH LOGO_LimeWhite_DarkBG.png');
  assert.deepEqual(
    await getAsset(assetPath(result), root, [], 'ios', ['png']),
    await readFile(path.join(root, 'assets', 'DH LOGO_LimeWhite_DarkBG.png')),
  );
  assert.equal(new URL(result, 'http://localhost').search, '?platform=ios&hash=test');
});

test('leaves valid assets, filenames, bundle requests and unrelated URLs unchanged', () => {
  for (const request of [
    '/assets/?unstable_path=.%2Fassets/logo.png&platform=ios',
    '/assets/logo%20with%20spaces.png?platform=ios',
    '/assets/?unstable_path=.%2Fassets/percent%2520name.png',
    '/index.bundle?platform=ios&dev=true',
    '/api/example?unstable_path=.%252Fassets',
  ]) assert.equal(rewrite(request), request);
});

test('normalization is idempotent and preserves absolute server origins', () => {
  const result = rewrite('http://localhost:8081/assets/?unstable_path=.%252Fassets/logo.png&platform=ios');
  assert.equal(rewrite(result), result);
  assert.equal(new URL(result).origin, 'http://localhost:8081');
  assert.equal(new URL(result).searchParams.get('platform'), 'ios');
});
