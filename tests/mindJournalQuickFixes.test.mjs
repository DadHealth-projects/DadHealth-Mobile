import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const { MIND_JOURNAL_PROMPTS, TEXT_A_MATE_DRAFT, selectMindJournalPrompts, localDateKey } = createRequire(import.meta.url)('../lib/mindExperienceContent.js');

test('approved low and positive prompts stay exact; neutral set contains three draft prompts', async () => {
  const source = await read('lib/mindExperienceContent.js');
  for (const copy of [
    "What's weighing on you most?",
    "What's one thing in your control today?",
    'What small step could help today?',
    'What went well, and what did you do to help that?',
    'Who or what helped make that possible?',
    "What's one thing you want to carry into tomorrow?",
  ]) assert.ok(source.includes(copy), `Missing approved draft: ${copy}`);
  assert.match(source, /neutral: \[[\s\S]*?What's on your mind right now\?[\s\S]*?What feels most important today\?[\s\S]*?What's one small next step that feels manageable\?/);
  assert.match(source, /Draft Mind experience copy\. Jamie approval required/);
});

test('prompt choice uses any low answer, all-positive answers, and neutral fallback', async () => {
  const source = await read('lib/mindExperienceContent.js');
  assert.equal(selectMindJournalPrompts({ mood_value: 4, energy_level: 2, connection_level: 5 }), MIND_JOURNAL_PROMPTS.low);
  assert.equal(selectMindJournalPrompts({ mood_value: 4, energy_level: 5, connection_level: 4 }), MIND_JOURNAL_PROMPTS.positive);
  assert.equal(selectMindJournalPrompts({ mood_value: 4, energy_level: 3, connection_level: 5 }), MIND_JOURNAL_PROMPTS.neutral);
  assert.equal(selectMindJournalPrompts(null), MIND_JOURNAL_PROMPTS.neutral);
  assert.match(source, /localDateKey/);
  assert.equal(localDateKey(new Date(2026, 0, 2)), '2026-01-02');
  assert.match(await read('screens/subscreens/JournalScreen.tsx'), /moodLogs\.find\(\(log\) => log\.date === localDateKey\(\)\)/);
});

test('Journal modes save one guided entry through existing queue and retain all history', async () => {
  const [screen, hook, storage] = await Promise.all([
    read('screens/subscreens/JournalScreen.tsx'),
    read('hooks/useJournalEntries.ts'),
    read('lib/offlineSync.ts'),
  ]);
  assert.match(screen, /Write freely/);
  assert.match(screen, />Guide me</);
  assert.match(screen, /map\(\(answer, index\).*guidedPrompts\[index\]/);
  assert.match(screen, /journal\.createEntry\(trimmed, editorMode === 'guide' \? 'Guided Journal'/);
  assert.match(screen, /journal\.entries\.map\(\(entry\)/);
  assert.match(hook, /createJournalQueueItem/);
  assert.match(hook, /enqueueOfflineWrite\(item\)/);
  assert.match(storage, /item\.kind === 'journal_create'/);
});

test('Quick Fixes use timed local sessions, normal Journal save, native message draft, and private disposable audio', async () => {
  const [quickFixes, config] = await Promise.all([read('components/mind/MindQuickFixes.tsx'), read('app.json')]);
  for (const title of ['Voice note', 'Brain dump', 'Text a mate', 'Shoulders / jaw reset']) assert.ok(quickFixes.includes(title));
  assert.match(quickFixes, /requestRecordingPermissionsAsync\(\)/);
  assert.match(quickFixes, /directory: 'cache'/);
  assert.match(quickFixes, /FileSystem\.deleteAsync\(uri, \{ idempotent: true \}\)/);
  assert.match(quickFixes, /forDuration: 60/);
  assert.match(quickFixes, /KeyboardAvoidingView/);
  assert.match(quickFixes, /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
  assert.match(quickFixes, /keyboardDismissMode="interactive"/);
  assert.match(quickFixes, /kind === 'brain-dump' \? '' : 'flex-grow'/);
  assert.match(quickFixes, /flex-1 justify-center gap-lg/);
  assert.match(quickFixes, /kind === 'voice' && state === 'complete' \? 'Back to Mind' : 'Close quick fix'/);
  assert.match(quickFixes, /name=\{kind === 'voice' && state === 'complete' \? 'arrow-left' : 'x'\}/);
  assert.match(quickFixes, /label="Done" onPress=\{onClose\}/);
  assert.match(quickFixes, /setInterval\(\(\) =>/);
  assert.match(quickFixes, /AppState\.addEventListener/);
  assert.match(quickFixes, /journal\.createEntry\(trimmed, 'Brain dump'\)/);
  assert.match(quickFixes, /Linking\.openURL\(url\)/);
  assert.match(quickFixes, /keyboardShouldPersistTaps="handled"/);
  assert.match(quickFixes, /RESET_STEPS\[1\]\.instruction/);
  assert.match(config, /"microphonePermission": "Allow Dad Health to record a private, temporary voice note\."/);
  assert.match(config, /"enableBackgroundRecording": false/);
});

test('Mind order keeps crisis and Mind Reset, then quick fixes, plan, Journal and support', async () => {
  const source = await read('screens/MindScreen.tsx');
  const positions = [
    source.indexOf('Need urgent help?'),
    source.indexOf('title="Mind Reset"'),
    source.indexOf('<MindQuickFixes'),
    source.indexOf('<MindPlanLockedCard'),
    source.indexOf('title="Journal"'),
    source.indexOf('title="Find a therapist"'),
    source.indexOf('title="Community"'),
    source.indexOf('<MoodWeekCard'),
  ];
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.doesNotMatch(source, /MindSessionModal|Guided reflection/);
});
