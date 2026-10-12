import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function sourceFiles(directory) {
  const entries = await readdir(new URL(`${directory}/`, root), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(?:[cm]?[jt]sx?)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

test('global floating crisis button is unmounted and absent from app screens', async () => {
  const rootNavigator = await readFile(new URL('contexts/RootNavigator.tsx', root), 'utf8');
  assert.doesNotMatch(rootNavigator, /GlobalCrisisHelpButton|ScreenContentReadyContext/);
  await assert.rejects(readFile(new URL('components/GlobalCrisisHelpButton.tsx', root)), { code: 'ENOENT' });
  await assert.rejects(readFile(new URL('contexts/ScreenContentReadyContext.tsx', root)), { code: 'ENOENT' });

  const files = (await Promise.all(['components', 'contexts', 'navigation', 'screens'].map(sourceFiles))).flat();
  const matches = await Promise.all(files.map(async (file) => [file, await readFile(new URL(file, root), 'utf8')]));
  assert.deepEqual(matches.filter(([, source]) => /GlobalCrisisHelpButton|Need to talk to someone\?/.test(source)).map(([file]) => file), []);
});

test('Mind has one accessible 44pt urgent-help link with a separate call action', async () => {
  const mind = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');
  assert.equal((mind.match(/accessibilityLabel="Need urgent help\?"/g) ?? []).length, 1);
  assert.match(mind, /accessibilityHint=.*Opens Samaritans support details/);
  assert.match(mind, /min-h-\[44px\]/);
  assert.match(mind, /Alert\.alert\(\s*'Need urgent help\?'[\s\S]*?crisisSupportPhoneDisplay\(\)[\s\S]*?\{ text: 'Not now', style: 'cancel' \}[\s\S]*?\{ text: 'Call Samaritans', onPress: \(\) => void openCrisisSupport\(\) \}/);
  assert.doesNotMatch(mind, /CrisisSupportRow|CrisisSupportCard|Crisis Support|Linking\.openURL/);
});

test('Mind support uses existing Samaritans contact and mockup has no legacy crisis card', async () => {
  const [config, helper, mockup] = await Promise.all([
    readFile(new URL('lib/homeContent.ts', root), 'utf8'),
    readFile(new URL('lib/crisisSupport.ts', root), 'utf8'),
    readFile(new URL('mockups/DadHealth_AppStore_Screenshots (1).html', root), 'utf8'),
  ]);

  assert.match(config, /crisis: \{ label: 'CRISIS SUPPORT .* tel: '116123' \}/);
  assert.match(helper, /import \{ FOOTER \} from '\.\/homeContent'/);
  assert.match(helper, /Linking\.openURL\(`tel:\$\{FOOTER\.crisis\.tel\}`\)/);
  assert.match(helper, /Unable to start the call/);
  assert.doesNotMatch(mockup, /Crisis support|Samaritans.*CALM.*Mind/);
});
