import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readMobile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readWeb = (path) => readFile(new URL(`../../dadHealth/${path}`, import.meta.url), 'utf8');

test('Admin reports schedule load failures without migration instructions and clears stale errors', async () => {
  const admin = await readWeb('src/app/admin/page.tsx');
  assert.match(admin, /Could not load scheduled workouts\. Refresh and try again\./);
  assert.doesNotMatch(admin, /Apply the pending database migration first/);
  assert.match(admin, /if \(schedulesResponse\.ok\)[\s\S]*?setScheduleError\(null\)/);
  assert.match(admin, /if \(!response\.ok\)[\s\S]*?setScheduleError\(result\?\.error[\s\S]*?\)[\s\S]*?return;[\s\S]*?setScheduleError\(null\);[\s\S]*?await load\(\)/);
});

test('entitlement verification errors stay off Body and appear only after explicit restricted-screen retry', async () => {
  const [body, hook, ai, meals] = await Promise.all([
    readMobile('screens/FitnessScreen.tsx'),
    readMobile('hooks/useEntitlement.ts'),
    readMobile('screens/subscreens/AIWorkoutScreen.tsx'),
    readMobile('screens/subscreens/MealPlannerScreen.tsx'),
  ]);
  assert.doesNotMatch(body, /fitnessLibrary\.proError|Unable to confirm Dad Health Pro access/);
  assert.match(body, /AI Workout access/);
  assert.match(body, /Meal Planner access/);
  assert.match(body, /Check access/);
  assert.match(hook, /verificationMessage: !loading && isPro === null/);
  for (const screen of [ai, meals]) {
    assert.match(screen, /Check access/);
    assert.match(screen, /accessCheckAttempted \? entitlement\.verificationMessage/);
    assert.match(screen, /await refreshEntitlement\(\)/);
  }
});

test('dashboard ignores responses from prior login identity after logout or account switch', async () => {
  const dashboard = await readMobile('hooks/useDashboard.ts');
  assert.match(dashboard, /dashboardIdentityVersion \+= 1/);
  assert.match(dashboard, /inFlightByUser\.clear\(\)/);
  assert.match(dashboard, /dashboardIdentityVersion !== identityVersion/);
  assert.match(dashboard, /if \(!userId\)[\s\S]*?setStore\(\{ userId: null, data: null, loading: false/);
  assert.match(dashboard, /postsResult,[\s\S]*?subscriptionStatus,[\s\S]*?loadNativeSubscriptionStatus\(\)\.catch\(\(\) => null\)/);
});

test('Today uses Body workout source and separates assignment loading, empty and failure states', async () => {
  const [dashboard, today] = await Promise.all([
    readMobile('hooks/useDashboard.ts'),
    readMobile('screens/DashboardScreen.tsx'),
  ]);
  assert.doesNotMatch(dashboard, /suggestedWorkout/);
  assert.match(today, /useFitnessLibrary\(user\.id\)/);
  assert.match(today, /workoutError/);
  assert.match(today, /Checking this week's workout/);
  assert.match(today, /No workout has been assigned this week yet/);
  assert.match(today, /else navigation\.navigate\('Tabs', \{ screen: 'Fit' \}\)/);
});
