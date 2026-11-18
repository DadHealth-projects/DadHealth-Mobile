import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Free keeps decorative locked preview; eligible accounts use saved Mind Plan sheet', async () => {
  const [mind, card, sheet, preview] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('components/mind/MindPlanLockedCard.tsx', root), 'utf8'),
    readFile(new URL('components/mind/PersonalisedMindPlanSheet.tsx', root), 'utf8'),
    readFile(new URL('assets/mind-plan-blurred-preview.png', root)),
  ]);

  assert.match(mind, /planAccess === true \? \([\s\S]*?setMindPlanOpen\(true\)/);
  assert.match(mind, /planAccess === false \? \([\s\S]*?<MindPlanLockedCard/);
  assert.match(mind, /navigateToProSubscription\(navigation, 'mind_plan'/);
  assert.match(mind, /<PersonalisedMindPlanSheet[\s\S]*?onClose=/);
  assert.match(card, /Personalised/);
  assert.match(card, /Personalised Mind Plan/);
  assert.match(card, /A seven-day plan shaped around your goals\./);
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
  assert.match(sheet, /Start my plan/);
  assert.match(sheet, /Mark as done/);
  assert.doesNotMatch(sheet, /mood, Dad Health Score and history|Your plan content will appear/);
});
