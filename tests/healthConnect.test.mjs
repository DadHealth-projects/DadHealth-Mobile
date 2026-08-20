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
  assert.equal(packageData.dependencies['expo-build-properties'], '~1.0.10');

  const expectedPermissions = [
    'android.permission.health.READ_STEPS',
    'android.permission.health.READ_EXERCISE',
    'android.permission.health.READ_RESTING_HEART_RATE',
    'android.permission.health.READ_SLEEP',
  ];
  const healthPermissions = appData.expo.android.permissions.filter((permission) =>
    permission.startsWith('android.permission.health.'),
  );
  assert.deepEqual(healthPermissions.sort(), expectedPermissions.sort());

  for (const recordType of ['Steps', 'ExerciseSession', 'RestingHeartRate', 'SleepSession']) {
    assert.ok(integration.includes(`recordType: '${recordType}'`), `Missing ${recordType}`);
  }
  for (const forbidden of ['Weight', 'ActiveCaloriesBurned', 'ExerciseRoute', 'BackgroundAccessPermission', 'ReadHealthDataHistory']) {
    assert.equal(integration.includes(`recordType: '${forbidden}'`), false, `Unexpected ${forbidden} access`);
  }
});

test('Health Connect uses the approved aggregation and sync cadence', async () => {
  const [integration, manager] = await Promise.all([
    source('lib/healthConnect.ts'),
    source('components/HealthConnectManager.tsx'),
  ]);

  assert.match(integration, /aggregateGroupByPeriod\(\{\s*recordType: 'Steps'/);
  assert.match(integration, /aggregateGroupByPeriod\(\{\s*recordType: 'ExerciseSession'/);
  assert.match(integration, /EXERCISE_DURATION_TOTAL\?\.inSeconds/);
  assert.match(integration, /return syncHealthConnect\(userId, 30\)/);
  assert.match(integration, /options\.days \?\? 7/);
  assert.match(integration, /15 \* 60 \* 1000/);
  assert.match(manager, /state === 'active'/);
  assert.doesNotMatch(manager, /Background|TaskManager|setInterval/);
});

test('Health Connect writes only normalized metrics and preserves manual sleep handling', async () => {
  const [integration, dashboard, progress] = await Promise.all([
    source('lib/healthConnect.ts'),
    source('hooks/useDashboard.ts'),
    source('screens/subscreens/ProgressScreen.tsx'),
  ]);

  for (const metric of ["'steps'", "'active_mins'", "'resting_hr'"]) {
    assert.ok(integration.includes(metric), `Missing normalized metric ${metric}`);
  }
  assert.match(integration, /upsert_health_connect_daily_data/);
  assert.match(dashboard, /existingSleep\?\.source === 'health_connect'/);
  assert.match(progress, /integration\.provider === 'health_connect'/);
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
