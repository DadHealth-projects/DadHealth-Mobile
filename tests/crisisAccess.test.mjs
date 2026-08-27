import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('crisis support remains directly available without login or Pro access', async () => {
  const [rootNavigator, tabs, mind, crisisSupport] = await Promise.all([
    readFile(new URL('contexts/RootNavigator.tsx', root), 'utf8'),
    readFile(new URL('navigation/BottomTabNavigator.tsx', root), 'utf8'),
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('components/mockup/CrisisSupportRow.tsx', root), 'utf8'),
  ]);

  assert.match(rootNavigator, /if \(!session\)[\s\S]*?<AppNavigator key="tabs" initialRouteName="Tabs" \/>/);
  assert.match(tabs, /<Tab\.Screen name="Mind" component=\{MindScreen\} \/>/);
  assert.match(mind, /<CrisisSupportRow \/>/);
  assert.match(crisisSupport, /const SAMARITANS_PHONE_URL = 'tel:116123'/);
  assert.match(crisisSupport, /Linking\.openURL\(SAMARITANS_PHONE_URL\)/);
  assert.match(crisisSupport, /Please dial 116 123 directly to reach Samaritans/);
  assert.doesNotMatch(crisisSupport, /useAuth|isPro|ProSubscription|navigate\(['"]Login/);
});
