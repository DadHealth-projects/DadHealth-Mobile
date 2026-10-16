import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('startup uses the DH logo before JavaScript content is ready', async () => {
  const [appConfig, app, splash] = await Promise.all([
    source('app.json'),
    source('App.js'),
    source('components/Splash.tsx'),
  ]);
  const config = JSON.parse(appConfig);

  const splashPlugin = config.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
  assert.deepEqual(splashPlugin?.[1], {
    image: './assets/02. DAD HEALTH LOGO_COLOR_Dark BG.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0A',
    imageWidth: 200,
  });
  assert.match(app, /if \(!fontsLoaded\) \{\s*return <Splash \/>;/);
  assert.match(splash, /02\. DAD HEALTH LOGO_COLOR_Dark BG\.png/);
  assert.doesNotMatch(splash, /BrandWordmark/);
});

test('public Home renders fallback content immediately and reserves its skeleton for manual refresh', async () => {
  const [home, hook] = await Promise.all([
    source('screens/HomeScreen.tsx'),
    source('hooks/usePublicHome.ts'),
  ]);

  assert.match(home, /refreshing \? \([\s\S]*?<PublicHomeSkeleton \/>/);
  assert.doesNotMatch(home, /if \(loading\)/);
  assert.match(hook, /useState\(false\)/);
  assert.match(hook, /void load\(false\)/);
  assert.match(hook, /const refresh = useCallback\(\(\) => load\(true\)/);
});
