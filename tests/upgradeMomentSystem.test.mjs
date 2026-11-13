import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

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

test('upgrade navigation carries source and context; single top chevron pops the route for Free and Pro', async () => {
  const [navigation, paywall, provider] = await Promise.all([
    read('lib/proNavigation.ts'),
    read('screens/subscreens/ProSubscriptionScreen.tsx'),
    read('contexts/UpgradeMomentContext.tsx'),
  ]);
  assert.match(navigation, /navigation\.dispatch\(StackActions\.push\('ProSubscription', \{ source, context, feature \}\)\)/);
  assert.match(navigation, /trackEvent\('lock_tapped', \{ feature, source \}/);
  assert.match(navigation, /trackEvent\('paywall_opened', \{ feature, source \}/);
  const source = ts.createSourceFile('ProSubscriptionScreen.tsx', paywall, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const exits = [];
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Pressable'

      && node.openingElement.attributes.properties.some((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'accessibilityLabel'
          && attribute.initializer?.getText(source) === '"Close Dad Health Pro"')) {
      exits.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(exits.length, 1, 'one labelled exit button');
  assert.doesNotMatch(paywall, /'Not now'|accessibilityLabel="Back"/);
  const buttonCode = ts.transpileModule(`(${exits[0].getText(source)})`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [isPro, label] of [[false, 'Close Dad Health Pro'], [true, 'Close Dad Health Pro']]) {
    let backCalls = 0;
    const button = vm.runInNewContext(buttonCode, {
      React: { createElement: (type, props, ...children) => ({ type, props, children }) },
      Pressable: 'Pressable', Text: 'Text', View: 'View', Feather: 'Icon', colors: { text: '#fff' },
      subscriptions: { status: { isPro } },
      navigation: { goBack: () => { backCalls++; } },
    });
    assert.equal(button.props.accessibilityLabel, label);
    assert.equal(button.children[0].children[0].props.name, 'chevron-left');
    assert.equal(backCalls, 0, 'render must not navigate');
    button.props.onPress();
    assert.equal(backCalls, 1, `${label} uses navigation.goBack()`);
  }
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
  assert.match(provider, /if \(!scope\.manager\.request\(request\)\) return false;[\s\S]*?upgrade_moment_shown/);
  assert.match(provider, /pending\.current = \{ request: active, upgrade \};[\s\S]*?upgrade_moment_dismissed/);
  assert.match(provider, /if \(!scope\.manager\.dismiss\(next\.request\.screen\)\) return;[\s\S]*?paywall_opened/);

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
