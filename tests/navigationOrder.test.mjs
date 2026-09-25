import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('bottom navigation has five tabs in Today, Mind, Body, Bond and Community order', async () => {
  const source = await readFile(new URL('navigation/BottomTabNavigator.tsx', root), 'utf8');
  const registeredTabs = [...source.matchAll(/<Tab\.Screen name="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(registeredTabs, ['Home', 'Mind', 'Fit', 'Bond', 'Squad']);
  assert.match(source, /initialRouteName="Home"/);
  assert.match(source, /Home:\s*\{[\s\S]*?label: 'Today'[\s\S]*?icon: 'home'/);
  assert.doesNotMatch(source, /name="Score"|ScoreTabScreen/);
  assert.match(source, /accessibilityLabel="LOG"/);
  assert.match(source, /state\.routes\.map\(\(route, index\) => renderTab\(route, index\)\)/);
  assert.match(source, /Squad:\s*\{\s*label: 'Community'/);
});

test('raised LOG action is separate from tabs and preserves logging destinations and dismissal', async () => {
  const source = await readFile(new URL('navigation/BottomTabNavigator.tsx', root), 'utf8');
  assert.match(source, /label: 'Log workout'/);
  assert.match(source, /label: 'Log Bond time'/);
  assert.match(source, /label: 'Log Mind activity'/);
  assert.match(source, /animationType="none"/);
  assert.match(source, /dismissLogSheet\(item\.action\)/);
  assert.match(source, /Animated\.timing\(sheetTranslateY/);
});

test('legacy Score notification links return to Today after Score leaves the tab navigator', async () => {
  const source = await readFile(new URL('lib/pushNotifications.ts', root), 'utf8');
  assert.match(source, /data\.type === 'weekly_score' \|\| data\.link === '\/progress'[\s\S]*?navigate\('Tabs', \{ screen: 'Home' \}\)/);
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
