import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('bottom navigation follows Today, Mind, Score, Body, Bond and Community order', async () => {
  const source = await readFile(new URL('navigation/BottomTabNavigator.tsx', root), 'utf8');
  const registeredTabs = [...source.matchAll(/<Tab\.Screen name="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(registeredTabs, ['Home', 'Mind', 'Score', 'Fit', 'Bond', 'Squad']);
  assert.match(source, /initialRouteName="Home"/);
  assert.match(source, /Home:\s*\{[\s\S]*?label: 'Today'[\s\S]*?icon: 'home'/);
  assert.match(source, /Score:\s*\{[\s\S]*?label: 'Score'[\s\S]*?icon: 'bar-chart-2'[\s\S]*?center: true/);
  assert.match(source, /name="Score" component=\{ScoreTabScreen\} options=\{\{ lazy: true \}\}/);
  assert.match(source, /Squad:\s*\{\s*label: 'Community'/);
});

test('Score reuses Progress content while Progress remains a compatible stack destination', async () => {
  const [tabs, stack] = await Promise.all([
    readFile(new URL('navigation/BottomTabNavigator.tsx', root), 'utf8'),
    readFile(new URL('navigation/AppNavigator.tsx', root), 'utf8'),
  ]);

  assert.match(tabs, /function ScoreTabScreen\(\)[\s\S]*?<ProgressScreen tabMode \/>/);
  assert.match(stack, /name="Progress"[\s\S]*?component=\{ProgressScreen\}/);
});

test('Score is a raised circular centre button and six labels fit a 320-point tab bar', async () => {
  const source = await readFile(new URL('navigation/BottomTabNavigator.tsx', root), 'utf8');
  const tabWidth = 320 / 6;
  const fittedCommunityWidth = ((9 * 8 * 0.55) + (8 * 0.25) + 4) * 0.85;

  assert.ok(fittedCommunityWidth < tabWidth);
  assert.doesNotMatch(source, /TAB_FLEX/);
  assert.match(source, /const compact = width < 380/);
  assert.match(source, /const spacious = width >= 390/);
  assert.match(source, /numberOfLines=\{1\}/);
  assert.match(source, /adjustsFontSizeToFit/);
  assert.match(source, /const iconSize = compact \? 20 : spacious \? 23 : 21/);
  assert.match(source, /const labelFontSize = compact \? 8 : spacious \? 10 : 9/);
  assert.match(source, /const centerButtonSize = compact \? 50 : 56/);
  assert.match(source, /borderRadius: centerButtonSize \/ 2/);
  assert.match(source, /\{meta\.label\}/);
});

test('Community naming and Dad Circles copy are consistent in user-facing screens', async () => {
  const [community, createPost, notificationSettings] = await Promise.all([
    readFile(new URL('screens/CommunityScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/CreateCommunityPostScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/NotificationSettingsScreen.tsx', root), 'utf8'),
  ]);

  assert.match(community, /title="Your Dad Circles"/);
  assert.match(community, /Find dads going through the same chapter as you\./);
  assert.match(community, /Be the first to share with the community\./);
  assert.match(createPost, /with the community/);
  assert.match(notificationSettings, /linkLabel: 'Community'/);
});
