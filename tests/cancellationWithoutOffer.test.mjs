import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const ui = read('components/subscriptions/CancellationFlow.tsx');
const hook = read('hooks/useNativeSubscriptions.ts');
const service = read('lib/nativeSubscriptions.ts');
const screen = read('screens/subscreens/ProSubscriptionScreen.tsx');

test('cancellation continues directly to provider handoff', () => {
  const flow = ui.slice(
    ui.indexOf('const continueFromReason'),
    ui.indexOf('const handoff')
  );
  assert.match(flow, /setStep\('handoff'\)/);
  assert.match(flow, /setSelectedId\(selected.id\)/);
});

test('cancellation feedback and provider management remain available', () => {
  assert.match(ui, /await saveCancellationFeedback\(owner, attempt\)/);
  assert.match(ui, /await manage\(selected.id\)/);
  assert.match(ui, /Continue without saving feedback/);
});

test('confirmed scheduled cancellation retains access until expiry', () => {
  assert.match(ui, /item.cancellation.state === 'scheduled'/);
  assert.match(ui, /Date.parse\(item.currentPeriodEnd \?\? ''\) > Date.now\(\)/);
  assert.match(ui, /keep full access to Pro until this date/);
});

test('retention discount functionality is absent', () => {
  for (const source of [ui, hook, service, screen]) {
    assert.doesNotMatch(source, /RetentionOffer|OFFER_COPY|redeemOffer|loadOffer|retentionOfferApplied|withOffer:/);
  }
});
