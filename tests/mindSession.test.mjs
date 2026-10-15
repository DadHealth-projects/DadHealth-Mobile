import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Mind Reset timing and all approved guidance stay unchanged', async () => {
  const reset = await readFile(new URL('lib/mindReset.ts', root), 'utf8');
  assert.match(reset, /BREATHING_DURATION_SECONDS = 60/);
  assert.match(reset, /RESET_STEP_DURATION_SECONDS = 48/);
  assert.match(reset, /RESET_DURATION_SECONDS = RESET_STEP_DURATION_SECONDS \* 5/);
  assert.deepEqual([...reset.matchAll(/title: '([^']+)'/g)].map(([, title]) => title), [
    'Settle', 'Release tension', 'Ground yourself', 'Name what is here', 'Choose one next step',
  ]);
  assert.match(reset, /Notice any physical tension\. If it feels comfortable, relax your shoulders, jaw and hands\./);
});

test('Today and Mind still open same Mind Reset and Today retains five-minute copy', async () => {
  const [today, mind, recommendation, report] = await Promise.all([
    readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('lib/checkInRecommendation.js', root), 'utf8'),
    readFile(new URL('lib/weeklyReport.ts', root), 'utf8'),
  ]);
  assert.match(today, /Take a five-minute reset/);
  assert.match(mind, /title="Mind Reset"[\s\S]*?navigate\('BreathingSession'\)/);
  for (const source of [today, recommendation, report, mind]) {
    assert.doesNotMatch(source, /two-minute (reset|Mind reset|4-4-4 breathing reset)/i);
  }
});

test('Mind has one guided Journal path and no separate Guided Reflection entry point', async () => {
  const [mind, journal] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/JournalScreen.tsx', root), 'utf8'),
  ]);
  assert.doesNotMatch(mind, /Guided reflection|MindSessionModal|showReflection/);
  assert.match(mind, /title="Journal"[\s\S]*?navigate\('Journal'\)/);
  assert.match(journal, /Write freely/);
  assert.match(journal, />Guide me</);
  assert.match(journal, /Guided Journal/);
});
