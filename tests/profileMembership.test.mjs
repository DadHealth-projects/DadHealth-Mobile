import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Profile replaces web dashboard link with server-confirmed membership states', async () => {
  const profile = await read('screens/subscreens/ProfileScreen.tsx');
  assert.doesNotMatch(profile, /open web dashboard|WEB_URL|Linking\.openURL/i);
  assert.match(profile, /useDashboard\(user\?\.id\)/);
  assert.match(profile, /useEntitlement\(/);
  assert.match(profile, /membershipAccess === null[\s\S]*?Membership status unavailable/);
  assert.match(profile, /dashboardLoading \|\| membershipAccess === null[\s\S]*?Check Membership/);
  assert.match(profile, /membershipAccess === false[\s\S]*?Upgrade to Pro/);
  assert.match(profile, /entitlement\.trialActive === true[\s\S]*?Pro Trial/);
  assert.match(profile, /navigation\.navigate\('ProSubscription'/);
});

test('Account Sheet upgrade and membership entries reach the same subscription screen', async () => {
  const account = await read('components/AccountSheet.tsx');
  assert.match(account, /title: isConfirmedFree \? 'Upgrade to Pro' : 'Membership'/);
  assert.match(account, /navigateToProSubscription\(navigation, 'account', 'Dad Health Pro'/);
  assert.match(account, /navigation\.navigate\('ProSubscription', \{ source: 'account_membership'/);
});
