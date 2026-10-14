import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Mind has one combined Mind Reset entry and keeps Guided Reflection separate', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');
  assert.match(source, /eyebrow="5 minutes"[\s\S]*?title="Mind Reset"[\s\S]*?navigate\('BreathingSession'\)/);
  assert.match(source, /title="Guided reflection"[\s\S]*?setShowReflection\(true\)/);
  assert.doesNotMatch(source, /title="4-4-4 Breathing"|title="Reset exercise"/);
});

test('Mind Reset timeline uses one breathing minute and five 48-second Reset steps', async () => {
  const [reset, screen] = await Promise.all([
    readFile(new URL('lib/mindReset.ts', root), 'utf8'),
    readFile(new URL('screens/subscreens/BreathingSessionScreen.tsx', root), 'utf8'),
  ]);
  assert.match(reset, /BREATHING_DURATION_SECONDS = 60/);
  assert.match(reset, /RESET_STEP_DURATION_SECONDS = 48/);
  assert.match(reset, /RESET_DURATION_SECONDS = RESET_STEP_DURATION_SECONDS \* 5/);
  assert.match(reset, /MIND_RESET_DURATION_SECONDS = BREATHING_DURATION_SECONDS \+ RESET_DURATION_SECONDS/);
  assert.match(reset, /if \(elapsedSeconds < BREATHING_DURATION_SECONDS\) return 'breathing'/);
  assert.match(reset, /if \(elapsedSeconds < MIND_RESET_DURATION_SECONDS\) return 'reset'/);
  assert.match(reset, /Math\.floor\(\(elapsedSeconds - BREATHING_DURATION_SECONDS\) \/ RESET_STEP_DURATION_SECONDS\)/);
  assert.deepEqual([...reset.matchAll(/title: '([^']+)'/g)].map(([, title]) => title), [
    'Settle', 'Release tension', 'Ground yourself', 'Name what is here', 'Choose one next step',
  ]);
  assert.match(reset, /Take a moment to settle\. Let your breathing slow at a comfortable pace\./);
  assert.match(reset, /Notice any physical tension\. If it feels comfortable, relax your shoulders, jaw and hands\./);
  assert.match(reset, /Notice what you can see, hear and feel around you\./);
  assert.match(reset, /Name what is taking up your attention, without judging it\./);
  assert.match(reset, /Choose one small thing you can do next\./);
  assert.match(screen, /Finish here/);
  assert.match(screen, /setInterval\(\(\) => \{/);
  assert.match(screen, /clearInterval\(timer\)/);
  assert.match(screen, /AppState\.addEventListener/);
  assert.match(screen, /if \(!isFocused\) pauseSession\(\)/);
});

test('Today, check-in recommendations and weekly report use five-minute Mind Reset wording', async () => {
  const [today, recommendation, report, mind] = await Promise.all([
    readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8'),
    readFile(new URL('lib/checkInRecommendation.ts', root), 'utf8'),
    readFile(new URL('lib/weeklyReport.ts', root), 'utf8'),
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
  ]);
  for (const source of [today, recommendation, report, mind]) {
    assert.doesNotMatch(source, /two-minute (reset|Mind reset|4-4-4 breathing reset)/i);
  }
  assert.match(today, /Take a five-minute reset/);
  assert.match(recommendation, /Take a five-minute Mind Reset/);
  assert.match(report, /Take a five-minute Mind Reset/);
  assert.match(mind, /title="Mind Reset"[\s\S]*?navigate\('BreathingSession'\)/);
});

test('reflection remains ten-minute guided flow and keeps its prompts', async () => {
  const source = await readFile(new URL('components/mind/MindSessionModal.tsx', root), 'utf8');
  assert.match(source, /10 minutes[\s\S]*Guided reflection/);
  assert.doesNotMatch(source, /Reset exercise|resetStarted|RESET_STEPS/);
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

test('reflection completion and journal save use the existing journal flow', async () => {
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
