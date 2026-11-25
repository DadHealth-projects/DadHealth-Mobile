import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('Health Connect is pinned and requests only the approved read permissions', async () => {
  const [packageJson, appConfig, integration] = await Promise.all([
    source('package.json'),
    source('app.json'),
    source('lib/healthConnect.ts'),
  ]);
  const packageData = JSON.parse(packageJson);
  const appData = JSON.parse(appConfig);

  assert.equal(packageData.dependencies['react-native-health-connect'], '4.1.3');
  assert.equal(packageData.dependencies['expo-build-properties'], '~58.0.12');

  const expectedPermissions = [
    'android.permission.health.READ_STEPS',
    'android.permission.health.READ_EXERCISE',
    'android.permission.health.READ_SLEEP',
  ];
  const healthPermissions = appData.expo.android.permissions.filter((permission) =>
    permission.startsWith('android.permission.health.'),
  );
  assert.deepEqual(healthPermissions.sort(), expectedPermissions.sort());

  for (const recordType of ['Steps', 'ExerciseSession', 'SleepSession']) {
    assert.ok(integration.includes(`recordType: '${recordType}'`), `Missing ${recordType}`);
  }
  for (const forbidden of ['RestingHeartRate', 'Weight', 'ActiveCaloriesBurned', 'ExerciseRoute', 'BackgroundAccessPermission', 'ReadHealthDataHistory']) {
    assert.equal(integration.includes(`recordType: '${forbidden}'`), false, `Unexpected ${forbidden} access`);
  }
});

test('Health Connect uses the approved aggregation and sync cadence', async () => {
  const [integration, manager] = await Promise.all([
    source('lib/healthConnect.ts'),
    source('components/HealthConnectManager.tsx'),
  ]);

  // Client blocker 2 and 4: steps in 15-minute slices re-bucketed into account days; actual
  // exercise-session intervals (overlaps merged) instead of a device-day duration total.
  assert.match(integration, /aggregateGroupByDuration\(\{\s*recordType: 'Steps'[\s\S]*?timeRangeSlicer: \{ duration: 'MINUTES', length: 15 \}/);
  assert.match(integration, /readAllRecords\(healthConnect, 'ExerciseSession'/);
  assert.match(integration, /minutesByDay\(intervals, timeZone\)/);
  assert.match(integration, /return syncHealthConnect\(userId, 30\)/);
  // Routine syncs re-read 7 days; once a day the window widens to 30 for older corrections (client blocker 3).
  assert.match(integration, /options\.days \?\? await nextRefreshDays\('health_connect', userId\)/);
  const core = await source('lib/healthSyncCore.ts');
  assert.match(core, /export const ROUTINE_WINDOW_DAYS = 7;/);
  assert.match(core, /export const EXTENDED_WINDOW_DAYS = 30;/);
  assert.match(integration, /15 \* 60 \* 1000/);
  assert.match(manager, /state === 'active'/);
  assert.doesNotMatch(manager, /Background|TaskManager|setInterval/);
});

test('Health Connect writes only normalized metrics and preserves manual sleep handling', async () => {
  const [integration, offlineSync] = await Promise.all([
    source('lib/healthConnect.ts'),
    source('lib/offlineSync.ts'),
  ]);

  for (const metric of ["'steps'", "'active_mins'"]) {
    assert.ok(integration.includes(metric), `Missing normalized metric ${metric}`);
  }
  // Client blocker 6: resting heart rate is out of scope (no request, read or upload).
  assert.doesNotMatch(integration, /resting_hr|RestingHeartRate/);
  assert.match(integration, /upsert_health_connect_daily_data/);
  assert.match(offlineSync, /WEARABLE_SLEEP_SOURCES\.has/);
  assert.ok(offlineSync.includes("'health_connect'"));
  assert.match(offlineSync, /\.eq\('source', 'manual'\)/);
  assert.doesNotMatch(integration, /workout_sessions|\.from\('workouts'\)|insertRecords|deleteRecords/);
});

test('Health Connect production paths contain no console diagnostics', async () => {
  const paths = [
    'lib/healthConnect.ts',
    'hooks/useHealthConnect.ts',
    'components/HealthConnectManager.tsx',
    'screens/subscreens/HealthPermissionsScreen.tsx',
  ];

  for (const path of paths) {
    const contents = await source(path);
    assert.doesNotMatch(contents, /console\.(?:log|info|debug|warn|error)\s*\(/, `${path} contains diagnostics`);
  }
});

test('Health Connect privacy plugin generates one dedicated rationale target', async () => {
  const plugin = await source('plugins/withHealthConnectPrivacy.js');

  assert.match(plugin, /ACTION_SHOW_PERMISSIONS_RATIONALE/);
  assert.match(plugin, /android\.intent\.action\.VIEW_PERMISSION_USAGE/);
  assert.match(plugin, /android\.permission\.START_VIEW_PERMISSION_USAGE/);
  assert.match(plugin, /com\.google\.android\.apps\.healthdata/);
  assert.match(plugin, /https:\/\/www\.dadhealth\.co\.uk\/privacy/);
});
