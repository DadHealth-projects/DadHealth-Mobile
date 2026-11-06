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
  assert.match(app, /const \[fontsLoaded, fontError\] = useFonts/);
  assert.match(app, /if \(!fontsLoaded\) \{\s*return <Splash \/>;/);
  assert.match(splash, /02\. DAD HEALTH LOGO_COLOR_Dark BG\.png/);
  assert.doesNotMatch(splash, /BrandWordmark/);
});

test('successful font loading continues into the existing app content', async () => {
  const app = await source('App.js');

  assert.match(app, /if \(fontError\) \{\s*return <FontLoadingFailure onRetry=\{onRetry\} \/>;\s*\}/);
  assert.match(app, /if \(!fontsLoaded\) \{\s*return <Splash \/>;\s*\}\s*\n\s*return <AppContent \/>;/);
});

test('font-loading errors show a branded retry action that retries font loading', async () => {
  const app = await source('App.js');

  assert.match(app, /key=\{fontLoadAttempt\}/);
  assert.match(app, /const retryFontLoad = \(\) => setFontLoadAttempt\(\(attempt\) => attempt \+ 1\)/);
  assert.match(app, /Dad Health couldn&apos;t load its fonts\. Try again to continue\./);
  assert.match(app, /<Pressable\s+onPress=\{onRetry\}[\s\S]*?>[\s\S]*?Try again/);
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
