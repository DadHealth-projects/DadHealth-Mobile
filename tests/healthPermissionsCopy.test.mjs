import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Health Permissions uses production Apple Health copy', async () => {
  const screen = await readFile(
    new URL('screens/subscreens/HealthPermissionsScreen.tsx', root),
    'utf8',
  );
  const hook = await readFile(new URL('hooks/useAppleHealth.ts', root), 'utf8');
  const clientCopy = `${screen}\n${hook}`;

  for (const expected of [
    'Connect Apple Health',
    'Allow Dad Health to read your health data so your Fitness and Progress screens stay up to date automatically.',
    'Apple Health connected',
    'You can change what Dad Health can access anytime in Apple Health or iPhone Settings.',
    'Apple Health isn’t available on this device.',
    'Apple Health access wasn’t enabled. You can change this anytime in iPhone Settings.',
    'We couldn’t connect to Apple Health. Please try again.',
  ]) {
    assert.ok(clientCopy.includes(expected), `Missing production copy: ${expected}`);
  }

  for (const internalTerm of [
    'TestFlight',
    'Expo Go',
    'development build',
    'production build',
    'app build',
    'HealthKit',
    'missing capability',
  ]) {
    assert.equal(clientCopy.includes(internalTerm), false, `Client copy contains: ${internalTerm}`);
  }
});

test('Health Permissions keeps the four approved data rows', async () => {
  const screen = await readFile(
    new URL('screens/subscreens/HealthPermissionsScreen.tsx', root),
    'utf8',
  );

  for (const row of ['Steps', 'Active minutes', 'Resting heart rate', 'Sleep']) {
    assert.ok(screen.includes(row), `Missing health data row: ${row}`);
  }
});
