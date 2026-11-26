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
  // 61cfc6d reworded the access rows; both still show the verification message only after a manual check.
  assert.equal((body.match(/message=\{accessCheckAttempted \? entitlement\.verificationMessage : null\}/g) ?? []).length, 2);
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
  // a37a846: a failed status read is recorded as failed (unknown), never silently treated as Free.
  assert.match(dashboard, /postsResult,[\s\S]*?subscriptionStatusResult,[\s\S]*?withTimeout\(loadNativeSubscriptionStatus\(\), DASHBOARD_ENTITLEMENT_BUDGET_MS\)\.then\(\s*\(status\) => \(\{ status, failed: false \}\),\s*\(\) => \(\{ status: null, failed: true \}\),/);
});

test('Today uses Body workout source and separates assignment loading, empty and failure states', async () => {
  const [dashboard, today] = await Promise.all([
    readMobile('hooks/useDashboard.ts'),
    readMobile('screens/DashboardScreen.tsx'),
  ]);
  assert.doesNotMatch(dashboard, /suggestedWorkout/);
  assert.match(today, /useFitnessLibrary\(user\.id, activeSection === 'HOME'/);
  assert.match(today, /workoutError/);
  // The Today's workout card claims "no workout" only once the assignment is known (fixed 2026-11-24).
  const card = today.slice(today.indexOf('<TodayWorkoutCard'), today.indexOf('hasWorkout=', today.indexOf('<TodayWorkoutCard')));
  const order = ["workoutError", "Couldn't load this week's workout", 'assignmentKnown', 'No workout scheduled this week', 'isOffline', "'Explore the workout library to find something that works for you.'"].map((text) => card.indexOf(text));
  order.forEach((index) => assert.ok(index > 0, card));
  for (let i = 1; i < order.length; i += 1) assert.ok(order[i] > order[i - 1], 'workout card states are out of order');
  assert.match(today, /No workout has been assigned this week yet/);
  assert.match(today, /else navigation\.navigate\('Tabs', \{ screen: 'Fit' \}\)/);
});
