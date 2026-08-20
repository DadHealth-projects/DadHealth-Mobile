import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('native billing plugin and store identifiers are configured without changing the app identifier', async () => {
  const [appConfig, env] = await Promise.all([source('app.json'), source('.env.example')]);
  const app = JSON.parse(appConfig).expo;
  assert.equal(app.ios.bundleIdentifier, 'co.uk.dadhealth');
  assert.equal(app.android.package, 'co.uk.dadhealth');
  assert.ok(app.plugins.some((plugin) => plugin === 'react-native-iap'));
  for (const name of [
    'EXPO_PUBLIC_APPLE_IAP_PRO_MONTHLY_PRODUCT_ID',
    'EXPO_PUBLIC_APPLE_IAP_PRO_ANNUAL_PRODUCT_ID',
    'EXPO_PUBLIC_GOOGLE_PLAY_PRO_PRODUCT_ID',
    'EXPO_PUBLIC_GOOGLE_PLAY_PRO_MONTHLY_BASE_PLAN_ID',
    'EXPO_PUBLIC_GOOGLE_PLAY_PRO_ANNUAL_BASE_PLAN_ID',
  ]) {
    assert.match(env, new RegExp(`^${name}=`, 'm'));
  }
});

test('native purchases are bound to the signed-in account and verified before finishing', async () => {
  const [service, hook] = await Promise.all([
    source('lib/nativeSubscriptions.ts'),
    source('hooks/useNativeSubscriptions.ts'),
  ]);
  const verifyIndex = hook.indexOf('verifyNativePurchase(purchase)');
  const finishIndex = hook.indexOf('finishTransaction', verifyIndex);
  assert.match(hook, /appAccountToken: preparation\.appAccountToken/);
  assert.match(hook, /obfuscatedAccountId: preparation\.obfuscatedAccountId/);
  assert.match(service, /Authorization: `Bearer \$\{data\.session\.access_token\}`/);
  assert.ok(verifyIndex >= 0);
  assert.ok(finishIndex > verifyIndex, 'Store transactions must finish only after server verification');
  assert.doesNotMatch(service, /refresh_token|service.role|password/i);
});

test('purchase, restore and manage flows use additive native subscription endpoints', async () => {
  const [service, hook] = await Promise.all([
    source('lib/nativeSubscriptions.ts'),
    source('hooks/useNativeSubscriptions.ts'),
  ]);
  for (const endpoint of [
    '/api/native-subscriptions/status',
    '/api/native-subscriptions/prepare',
    '/api/native-subscriptions/verify/',
    '/api/native-subscriptions/manage',
  ]) assert.ok(service.includes(endpoint));
  assert.match(hook, /getAvailablePurchases/);
  assert.match(hook, /finishTransaction/);
  assert.match(hook, /Purchase cancelled\./);
  assert.match(hook, /Dad Health Pro is now active\./);
});

test('the approved mobile Pro entry points route to one native subscription screen', async () => {
  const [navigator, account, dashboard, screen] = await Promise.all([
    source('navigation/AppNavigator.tsx'),
    source('components/AccountSheet.tsx'),
    source('screens/DashboardScreen.tsx'),
    source('screens/subscreens/ProSubscriptionScreen.tsx'),
  ]);
  assert.match(navigator, /name="ProSubscription"/);
  assert.match(account, /navigate\('ProSubscription'\)/);
  assert.match(dashboard, /UpgradeProCard onPress=\{\(\) => navigation\.navigate\('ProSubscription'\)\}/);
  assert.match(screen, /£6\.99/);
  assert.match(screen, /£49\.99/);
  assert.match(screen, /Start 7-day free trial/);
  assert.match(screen, /Restore purchases/);
  assert.match(screen, /Manage subscription/);
  assert.doesNotMatch(screen, /\/pricing|Stripe|PaymentSheet/);
});
