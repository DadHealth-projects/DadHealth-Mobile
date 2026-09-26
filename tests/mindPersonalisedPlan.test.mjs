import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Free gets the existing Pro conversion CTA and Pro opens an isolated plan placeholder', async () => {
  const [mind, sheet] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('components/mind/PersonalisedMindPlanSheet.tsx', root), 'utf8'),
  ]);

  assert.match(mind, /data\?\.isPro \? \([\s\S]*?setMindPlanOpen\(true\)/);
  assert.match(mind, /moment=\{PRO_LOCKS\.mindPlan\}/);
  assert.match(mind, /navigation\.navigate\('ProSubscription'\)/);
  assert.match(mind, /<PersonalisedMindPlanSheet onClose=/);
  assert.match(sheet, /Personalised Mind Plan/);
  assert.match(sheet, /mood, Dad Health Score and history/);
  assert.doesNotMatch(sheet, /recommendation|generate|steps/);
});
