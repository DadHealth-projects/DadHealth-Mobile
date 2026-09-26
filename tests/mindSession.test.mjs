import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('both provisional Mind sessions are reachable from the Mind action list', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');
  assert.match(source, /title="Reset exercise"[\s\S]*?setMindSession\('reset'\)/);
  assert.match(source, /title="Guided reflection"[\s\S]*?setMindSession\('reflection'\)/);
  assert.match(source, /kind=\{mindSession\}/);
});

test('session headings and durations match the two Mind actions', async () => {
  const source = await readFile(new URL('components/mind/MindSessionModal.tsx', root), 'utf8');
  assert.match(source, /isReset \? '5 minutes' : `10 minutes/);
  assert.match(source, /\? 'Reset exercise' : 'Guided reflection'/);
  assert.match(source, /elapsedSeconds >= 5 \* 60/);
  assert.doesNotMatch(source, /\bREFLECTION_PROMPTS\b/);
  assert.match(source, /const WEEKLY_REFLECTION_PROMPTS = \[[\s\S]*?What am I feeling as this week begins\?[\s\S]*?What is one small thing I want to carry into tomorrow\?/);
});

test('reflection offers five distinct prompts for each day of the Monday-Sunday week', async () => {
  const source = await readFile(new URL('components/mind/MindSessionModal.tsx', root), 'utf8');
  const block = source.match(/const WEEKLY_REFLECTION_PROMPTS = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
  const groups = [...block.matchAll(/\{ day: '(\w+)', prompts: \[([\s\S]*?)\] \}/g)];
  assert.deepEqual(groups.map(([, day]) => day), ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  assert.equal(groups.length, 7);
  for (const [, , prompts] of groups) assert.equal([...prompts.matchAll(/^\s{4}'[^']+',?$/gm)].length, 5);
  assert.match(source, /WEEKLY_REFLECTION_PROMPTS\[new Date\(\)\.getDay\(\)\]/);
});

test('reset completion, journal handoff and reflection journal save use the existing journal flow', async () => {
  const [session, mind] = await Promise.all([
    readFile(new URL('components/mind/MindSessionModal.tsx', root), 'utf8'),
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
  ]);
  assert.match(session, /<LimeButton label="Done" onPress=\{onClose\}/);
  assert.match(session, /<SecondaryAction label="Write it down" onPress=\{onWriteToJournal\}/);
  assert.match(session, /await journal\.createEntry\(reflectionContent, `Guided reflection/);
  assert.match(session, /<LimeButton label=\{saved \? 'Done' : 'Save to journal'\}/);
  assert.doesNotMatch(session, /disabled=\{!answers\[promptIndex\]\.trim\(\)\}/);
  assert.match(session, /disabled=\{!saved && !hasReflectionAnswer\}/);
  assert.match(mind, /navigation\.navigate\('Journal'\)/);
});
