import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createUpgradeMomentSession } from '../lib/upgradeMomentManager.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const freeRequest = (overrides = {}) => ({
  id: 'checkIn',
  screen: 'today-route',
  isPro: false,
  trialActive: false,
  loading: false,
  featureAccess: false,
  hasCompletedAction: true,
  ...overrides,
});

test('shared moment manager allows confirmed Free after completed action only', () => {
  const manager = createUpgradeMomentSession();
  assert.equal(manager.request(freeRequest()), true);
  assert.equal(manager.request(freeRequest({ id: 'weeklyReport', screen: 'today-route' })), false);
  assert.equal(manager.dismiss('today-route'), true);
  assert.equal(manager.getActiveScreen(), null);
});

test('Pro, Trial, loading, unknown and pre-action states never show prompts', () => {
  for (const overrides of [
    { isPro: true },
    { trialActive: true },
    { loading: true },
    { isPro: null, featureAccess: null },
    { trialActive: null },
    { featureAccess: null },
    { hasCompletedAction: false },
  ]) {
    const manager = createUpgradeMomentSession();
    assert.equal(manager.request(freeRequest(overrides)), false, JSON.stringify(overrides));
    assert.equal(manager.getActiveScreen(), null);
  }
});

test('all seven brief moments are supported by the shared session manager', () => {
  const ids = ['score', 'checkIn', 'aiWorkout', 'dadDays', 'weeklyReport', 'progressTrends', 'dadDaysCounter'];
  for (const id of ids) {
    const manager = createUpgradeMomentSession();
    assert.equal(manager.request(freeRequest({ id })), true, id);
  }
});

test('each moment shows once per app session, including after dismissal', () => {
  const manager = createUpgradeMomentSession();
  assert.equal(manager.request(freeRequest()), true);
  assert.equal(manager.dismiss('today-route'), true);
  assert.equal(manager.request(freeRequest()), false);
  assert.equal(manager.isShown('checkIn'), true);

  const nextAppSession = createUpgradeMomentSession();
  assert.equal(nextAppSession.request(freeRequest()), true);
});

test('only one upgrade moment can be active across screens', () => {
  const manager = createUpgradeMomentSession();
  assert.equal(manager.request(freeRequest()), true);
  assert.equal(manager.request(freeRequest({ id: 'aiWorkout', screen: 'ai-route' })), false);
  assert.equal(manager.dismiss('today-route'), true);
  assert.equal(manager.request(freeRequest({ id: 'aiWorkout', screen: 'ai-route' })), true);
});

test('upgrade navigation carries source and context; Not now returns by popping route', async () => {
  const [navigation, paywall, provider] = await Promise.all([
    read('lib/proNavigation.ts'),
    read('screens/subscreens/ProSubscriptionScreen.tsx'),
    read('contexts/UpgradeMomentContext.tsx'),
  ]);
  assert.match(navigation, /navigation\.dispatch\(StackActions\.push\('ProSubscription', \{ source, context \}\)\)/);
  assert.match(navigation, /trackEvent\('lock_tapped', \{ feature, source \}/);
  assert.match(navigation, /trackEvent\('paywall_opened', \{ feature, source \}/);
  assert.match(paywall, /navigation\.goBack\(\)/);
  assert.match(paywall, /accessibilityLabel="Not now"/);
  assert.match(provider, /StackActions\.push\('ProSubscription', \{/);
  assert.match(provider, /source: request\.id/);
  assert.match(provider, /context: request\.lead \?\? PRO_MOMENTS\[request\.id\]\.body/);
});

test('upgrade analytics carry feature and source', async () => {
  const [navigation, provider, proLocked, proUpgrade, bodyLocked, badge, checkIn, scoreCard, scoreDetails, streak, weekly, mind, mindPlan] = await Promise.all([
    read('lib/proNavigation.ts'),
    read('contexts/UpgradeMomentContext.tsx'),
    read('components/ProLockedPreview.tsx'),
    read('components/ProUpgradeSection.tsx'),
    read('components/body/BodyProLockedCard.tsx'),
    read('components/dashboard/ProBadge.tsx'),
    read('components/dashboard/CheckInFollowUp.tsx'),
    read('components/dashboard/DadScoreCard.tsx'),
    read('components/dashboard/ScoreDetailSheet.tsx'),
    read('components/dashboard/StreakCard.tsx'),
    read('components/dashboard/WeeklyReportCard.tsx'),
    read('screens/MindScreen.tsx'),
    read('components/mind/MindPlanLockedCard.tsx'),
  ]);
  for (const event of ['lock_tapped', 'paywall_opened']) {
    assert.ok(navigation.includes(`trackEvent('${event}', { feature, source }`));
  }
  for (const event of ['upgrade_moment_shown', 'upgrade_moment_dismissed', 'paywall_opened']) {
    assert.ok(provider.includes(`trackEvent('${event}'`));
  }
  assert.match(provider, /upgrade_moment_dismissed', \{ feature: active\.feature, source: active\.id \}/);
  assert.match(provider, /if \(!manager\.request\(request\)\) return false;[\s\S]*?upgrade_moment_shown/);
  assert.match(provider, /if \(!manager\.dismiss\(active\.screen\)\) return;[\s\S]*?upgrade_moment_dismissed/);
  assert.match(provider, /if \(!manager\.dismiss\(request\.screen\)\) return;[\s\S]*?paywall_opened/);

  const lockSurfaces = [proLocked, proUpgrade, bodyLocked, scoreCard, checkIn, scoreDetails, streak, weekly, mind, mindPlan];
  for (const surface of lockSurfaces) {
    assert.match(surface, /trackEvent\('lock_viewed', \{ feature(?::|,)/);
    assert.match(surface, /trackEvent\('lock_viewed', \{[^}]*source(?::|[ },])/);
  }
  assert.equal(badge.includes('trackEvent'), false, 'badge is decorative; parent lock owns view tracking');
  const [dashboard, fitness, history] = await Promise.all([
    read('screens/DashboardScreen.tsx'),
    read('screens/FitnessScreen.tsx'),
    read('screens/subscreens/ManualActivityHistoryScreen.tsx'),
  ]);
  assert.match(dashboard, /openPro\('score', 'Understand your score', 'lock', 'score_insights'\)/);
  assert.match(fitness, /'progressTrends', 'Body progress trends', user\?\.id, 'lock', 'trends'/);
  assert.match(fitness, /'aiWorkout', 'AI Workout', user\?\.id, 'lock', 'ai_workout'/);
  assert.match(history, /'progressTrends', 'Manual activity trends', user\?\.id, 'lock', 'trends'/);
});
