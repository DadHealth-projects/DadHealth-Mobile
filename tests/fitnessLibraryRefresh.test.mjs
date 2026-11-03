import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createFitnessLibraryRefreshGate,
  shouldRefreshFitnessLibraryOnResume,
} from '../lib/fitnessLibraryRefresh.js';

const hook = await readFile(new URL('../hooks/useFitnessLibrary.ts', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../screens/DashboardScreen.tsx', import.meta.url), 'utf8');

test('AppState resume refresh runs for focused Home and stays idle for other tabs', async () => {
  const resumed = { nextState: 'active', previousState: 'background', userId: 'user', enabled: true };
  assert.equal(shouldRefreshFitnessLibraryOnResume(resumed), true);
  assert.equal(shouldRefreshFitnessLibraryOnResume({ ...resumed, enabled: false }), false);
  assert.equal(shouldRefreshFitnessLibraryOnResume({ ...resumed, userId: undefined }), false);
  assert.equal(shouldRefreshFitnessLibraryOnResume({ ...resumed, nextState: 'background' }), false);
  assert.match(dashboard, /useFitnessLibrary\(user\.id, activeSection === 'HOME', activeSection === 'HOME' && isFocused\)/);
  assert.match(hook, /shouldRefreshFitnessLibraryOnResume\(\{[\s\S]*?enabled: appStateRefreshEnabled/);

  const gate = createFitnessLibraryRefreshGate();
  let callCount = 0;
  if (shouldRefreshFitnessLibraryOnResume(resumed)) {
    await gate('resume', () => { callCount += 1; });
  }
  if (shouldRefreshFitnessLibraryOnResume({ ...resumed, enabled: false })) {
    await gate('resume', () => { callCount += 1; });
  }
  assert.equal(callCount, 1);
});

test('Returning to Home triggers the focus refresh and other hook consumers keep their default', () => {
  assert.match(hook, /useFocusEffect\(useCallback\(\(\) => \{[\s\S]*?refreshAutomatically\('focus'\)/);
  assert.match(hook, /appStateRefreshEnabled = enabled/);
  assert.match(hook, /const refresh = useCallback\(\(\) => load\(true\)/);
});

test('Pull-to-refresh remains an explicit fresh load', () => {
  assert.match(hook, /const refresh = useCallback\(\(\) => load\(true\), \[load\]\)/);
  assert.match(dashboard, /refreshWeeklyWorkout\(\)/);
  assert.match(hook, /if \(isOffline\) latestRequest\.current \+= 1/);
});

test('overlapping focus and resume events share one request', async () => {
  let now = 1000;
  let callCount = 0;
  let release;
  const gate = createFitnessLibraryRefreshGate(() => now);
  const pendingRefresh = new Promise((resolve) => { release = resolve; });

  const first = gate('focus', () => {
    callCount += 1;
    return pendingRefresh;
  });
  const second = gate('resume', () => { callCount += 1; });
  await Promise.resolve();
  assert.equal(callCount, 1);
  release();
  await Promise.all([first, second]);

  now += 100;
  await gate('resume', () => { callCount += 1; });
  assert.equal(callCount, 1);
});

test('a resume while Home is inactive does not suppress its later focus refresh', async () => {
  let now = 2000;
  let callCount = 0;
  const gate = createFitnessLibraryRefreshGate(() => now);
  const resume = { nextState: 'active', previousState: 'background', userId: 'user', enabled: false };

  assert.equal(shouldRefreshFitnessLibraryOnResume(resume), false);
  now += 10;
  await gate('focus', () => { callCount += 1; });
  assert.equal(callCount, 1);
});
