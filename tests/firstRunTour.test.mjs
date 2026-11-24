import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function loadHandoff() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read('lib/onboardingHandoff.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  return exports;
}

test('the tour is pending only right after this account finishes onboarding, and only once', () => {
  const h = loadHandoff();
  h.setupOwner('dad-a', false);
  assert.equal(h.firstRunTourPending('dad-a'), false, 'not before onboarding completes');
  h.beginInitialCheckIn('dad-a');
  assert.equal(h.firstRunTourPending('dad-a'), true);
  assert.equal(h.firstRunTourPending('dad-b'), false, 'never for another account');
  h.finishFirstRunTour('dad-a');
  assert.equal(h.firstRunTourPending('dad-a'), false, 'shown once');
  assert.equal(h.initialCheckInPending('dad-a'), true, 'the first check-in handoff continues after the tour');
  assert.equal(h.setupBlocksUpgrade('dad-a'), true, 'no paywall until the first check-in is handled');
});

test('account switch clears a pending tour; existing members never see it', () => {
  const h = loadHandoff();
  h.setupOwner('dad-a', false);
  h.beginInitialCheckIn('dad-a');
  h.setupOwner('dad-b', true);
  assert.equal(h.firstRunTourPending('dad-a'), false);
  assert.equal(h.firstRunTourPending('dad-b'), false, 'an already-onboarded member gets no tour');
});

test('three skippable screens, the last starts the check-in, and nothing mentions Pro or price', () => {
  const tour = read('components/onboarding/FirstRunTour.tsx');
  const titles = [...tour.matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(titles, ['Your Dad Health Score', 'Body, Mind and Bond', 'Your first check-in']);
  assert.match(tour, /accessibilityLabel="Skip the introduction"/);
  assert.match(tour, /onRequestClose=\{\(\) => onFinish\(false\)\}/, 'Android back skips');
  assert.match(tour, /label=\{last \? 'Start my check-in' : 'Next'\}/);
  assert.match(tour, /last \? onFinish\(true\) : setIndex\(index \+ 1\)/);
  assert.match(tour, /accessibilityLabel=\{`Step \$\{index \+ 1\} of \$\{FIRST_RUN_TOUR_STEPS\.length\}`\}/);
  assert.doesNotMatch(tour, /\bPro\b|£|price|subscribe|trial/i, 'no paywall during onboarding');
});

test('Today shows the tour before any other prompt and ends on the first check-in', () => {
  const screen = read('screens/DashboardScreen.tsx');
  assert.match(screen, /const \[tourVisible, setTourVisible\] = useState\(\(\) => firstRunTourPending\(user\.id\)\);/);
  assert.match(screen, /const tourBusy = tourVisible \|\| tourNativePresented;/);
  assert.match(screen, /!tourBusy && !checkInModalOpen && !requestedCheckIn && !scoreSheetOpen/, 'automatic check-in waits for the tour');
  assert.match(screen, /const pushModalBusy = tourBusy \|\| checkInModalOpen/, 'push permission and other sheets wait too');
  assert.match(screen, /eligible=\{permissionEligible && isFocused && !tourBusy && !checkInModalOpen/);
  assert.match(screen, /if \(tourBusy \|\| !startCheckInAfterTour\.current\) return;\s*startCheckInAfterTour\.current = false;\s*if \(checkedInToday === false\) openDailyCheckIn\(\);/,
    'the check-in opens only after the tour sheet has fully gone');
  assert.match(screen, /onDismiss=\{\(\) => setTourNativePresented\(false\)\}/);
  assert.match(screen, /finishFirstRunTour\(user\.id\);\s*startCheckInAfterTour\.current = startCheckIn;\s*setTourVisible\(false\);/);
});
