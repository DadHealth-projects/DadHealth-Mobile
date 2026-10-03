import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('shared multiline field uses native Done and dismisses its own keyboard', async () => {
  const component = await source('components/MultilineTextInput.tsx');
  assert.ok(component.includes('multiline'));
  assert.ok(component.includes('inputRef.current?.blur()'));
  assert.ok(component.includes('Keyboard.dismiss()'));
  assert.ok(component.includes('returnKeyType="done"'));
  assert.ok(component.includes('submitBehavior="blurAndSubmit"'));
  assert.equal(component.includes('Pressable'), false);
  assert.equal(component.includes('InputAccessoryView'), false);
});

test('all multiline mobile text entry uses the reusable field', async () => {
  const paths = [
    'components/mind/MindSessionModal.tsx',
    'screens/subscreens/JournalScreen.tsx',
    'screens/subscreens/ManualActivityLogScreen.tsx',
    'screens/subscreens/CreateCommunityPostScreen.tsx',
    'screens/subscreens/CommunityPostThreadScreen.tsx',
    'screens/subscreens/MilestoneTrackerScreen.tsx',
    'screens/subscreens/SharedCalendarScreen.tsx',
  ];
  const screens = await Promise.all(paths.map(source));
  for (let index = 0; index < paths.length; index += 1) {
    assert.ok(screens[index].includes('<MultilineTextInput'), `Missing reusable textarea in ${paths[index]}`);
  }
});

test('manual activity date picker and single-line search inputs stay native', async () => {
  const [manual, dadDays, component] = await Promise.all([
    source('screens/subscreens/ManualActivityLogScreen.tsx'),
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('components/MultilineTextInput.tsx'),
  ]);
  assert.ok(manual.includes('DateTimePicker'));
  assert.ok(manual.includes('<MultilineTextInput'));
  assert.ok(manual.includes('<TextInput value={durationText}'));
  assert.ok(dadDays.includes('<TextInput value={postcodeInput}'));
  assert.equal(dadDays.includes('MultilineTextInput'), false);
  assert.equal(component.includes('InputAccessoryView'), false);
});

test('single-line and numeric inputs expose native search or done actions', async () => {
  const [dadDays, manual, tdee, checkIn, login] = await Promise.all([
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('screens/subscreens/ManualActivityLogScreen.tsx'),
    source('screens/subscreens/TDEECalculatorScreen.tsx'),
    source('components/dashboard/CheckInPanel.tsx'),
    source('screens/subscreens/LoginScreen.tsx'),
  ]);

  assert.ok(dadDays.includes('returnKeyType="search"'));
  assert.ok(dadDays.includes('void usePostcode()'));
  assert.ok(manual.includes("keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'number-pad'} returnKeyType="));
  assert.ok(tdee.includes("keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'} returnKeyType="));
  assert.ok(checkIn.includes("keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}"));
  assert.ok(checkIn.includes('returnKeyType="done"'));
  assert.ok(login.includes('returnKeyType="next"'));
  assert.ok(login.includes('returnKeyType="done"'));
});
