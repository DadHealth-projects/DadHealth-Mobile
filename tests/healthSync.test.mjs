import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Fitness summary dates include synced health metrics', async () => {
  const hook = await readFile(new URL('hooks/useFitnessSummary.ts', root), 'utf8');

  assert.match(hook, /workouts\[0\]\?\.performed_at, metrics\[0\]\?\.recorded_at/);
  assert.match(hook, /latestLoggedDate: latestLoggedAt\?\.slice\(0, 10\)/);
});

test('Active Today only uses a metric recorded today', async () => {
  const hook = await readFile(new URL('hooks/useFitnessSummary.ts', root), 'utf8');

  assert.match(hook, /metric\.metric_type === 'active_mins' && metric\.recorded_at\.slice\(0, 10\) === today/);
});

test('Apple Health and fitness production paths contain no console diagnostics', async () => {
  const integration = await readFile(new URL('lib/appleHealth.ts', root), 'utf8');
  const manager = await readFile(new URL('components/AppleHealthManager.tsx', root), 'utf8');
  const fitness = await readFile(new URL('screens/FitnessScreen.tsx', root), 'utf8');
  const summary = await readFile(new URL('hooks/useFitnessSummary.ts', root), 'utf8');

  for (const source of [integration, manager, fitness, summary]) {
    assert.doesNotMatch(source, /console\.(?:log|info|debug|warn|error)\s*\(/);
  }
});
