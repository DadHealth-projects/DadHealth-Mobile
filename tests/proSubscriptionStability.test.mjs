import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('Pro screen keeps native subscription connection callback stable across renders', async () => {
  const [screen, hook] = await Promise.all([
    source('screens/subscreens/ProSubscriptionScreen.tsx'),
    source('hooks/useNativeSubscriptions.ts'),
  ]);

  assert.match(screen, /const refreshEntitlement = useCallback\(\(\) => \{\s*if \(user\?\.id\) void refreshDashboardForUser\(user\.id\);\s*\}, \[user\?\.id\]\);/);
  assert.match(screen, /useNativeSubscriptions\(user\?\.id, refreshEntitlement\)/);
  assert.doesNotMatch(screen, /useNativeSubscriptions\(\s*user\?\.id,\s*user\?\.id \? \(\) =>/);

  // Hook reconnects its store listeners when either callback dependency changes.
  assert.match(hook, /\}, \[processPurchase, refreshStatus\]\);/);
});
