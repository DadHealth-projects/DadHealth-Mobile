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

test('Apple Health sync and foreground failures have internal diagnostics', async () => {
  const integration = await readFile(new URL('lib/appleHealth.ts', root), 'utf8');
  const manager = await readFile(new URL('components/AppleHealthManager.tsx', root), 'utf8');
  const fitness = await readFile(new URL('screens/FitnessScreen.tsx', root), 'utf8');

  assert.ok(integration.includes("logAppleHealth('Health data read completed.'"));
  assert.ok(integration.includes('stepDays: steps.length'));
  assert.ok(manager.includes("console.warn('[AppleHealth] Foreground sync failed.'"));
  assert.ok(fitness.includes("console.warn('[AppleHealth] Body screen refresh failed.'"));
});
