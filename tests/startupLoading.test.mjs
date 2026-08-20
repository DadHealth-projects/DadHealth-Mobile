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

  assert.deepEqual(config.expo.splash, {
    image: './assets/DH LOGO_LimeWhite_DarkBG.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0A',
  });
  assert.match(app, /if \(!fontsLoaded\) \{\s*return <Splash \/>;/);
  assert.match(splash, /DH LOGO_LimeWhite_DarkBG\.png/);
  assert.doesNotMatch(splash, /BrandWordmark/);
});

test('public Home renders fallback content immediately while data refreshes quietly', async () => {
  const [home, hook] = await Promise.all([
    source('screens/HomeScreen.tsx'),
    source('hooks/usePublicHome.ts'),
  ]);

  assert.doesNotMatch(home, /PublicHomeSkeleton/);
  assert.doesNotMatch(home, /if \(loading\)/);
  assert.match(hook, /useState\(false\)/);
  assert.match(hook, /void load\(false\)/);
  assert.match(hook, /const refresh = useCallback\(\(\) => load\(true\)/);
});
