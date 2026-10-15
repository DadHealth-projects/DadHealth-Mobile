import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Free gets the locked Mind Plan card and Pro keeps the placeholder sheet', async () => {
  const [mind, card, sheet, preview] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('components/mind/MindPlanLockedCard.tsx', root), 'utf8'),
    readFile(new URL('components/mind/PersonalisedMindPlanSheet.tsx', root), 'utf8'),
    readFile(new URL('assets/mind-plan-blurred-preview.png', root)),
  ]);

  assert.match(mind, /data\?\.isPro === true \? \([\s\S]*?setMindPlanOpen\(true\)/);
  assert.match(mind, /<MindPlanLockedCard[\s\S]*?navigation\.navigate\('ProSubscription'\)/);
  assert.match(mind, /\) : data\?\.isPro === false \? \(/);
  assert.match(mind, /navigation\.navigate\('ProSubscription'\)/);
  assert.match(mind, /<PersonalisedMindPlanSheet onClose=/);
  assert.match(card, /Personalised/);
  assert.match(card, /Your Mind Plan/);
  assert.match(card, /A plan built around your mood, habits and goals\./);
  assert.match(card, /<Image[\s\S]*?source=\{require\('\.\.\/\.\.\/assets\/mind-plan-blurred-preview\.png'\)\}/);
  assert.match(card, /resizeMode="stretch"/);
  assert.match(card, /height: 150/);
  assert.match(card, /Locked preview of your personalised Mind Plan/);
  assert.deepEqual(Array.from(preview.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.doesNotMatch(card, /Daily practices|Activities for real life|Track your progress|PREVIEW_ROWS/);
  assert.doesNotMatch(card, /BlurTargetView|BlurView|expo-blur|previewRef|Platform\.OS/);
  assert.match(card, /name="crown"/);
  assert.match(card, /Unlock my plan/);
  assert.match(card, /border border-lime\/40 bg-card/);
  assert.doesNotMatch(card, /PREVIEW_ROW_WIDTHS|shadowRadius/);
  assert.doesNotMatch(card, /recommendation|generated plan|try this next/i);
  assert.match(sheet, /Personalised Mind Plan/);
  assert.match(sheet, /mood, Dad Health Score and history/);
  assert.doesNotMatch(sheet, /recommendation|generate|steps/);
});
