import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('the top status banner is reserved for persistent offline state', async () => {
  const [app, banner, network, topBar] = await Promise.all([
    source('App.js'),
    source('components/OfflineStatusBanner.tsx'),
    source('contexts/NetworkContext.tsx'),
    source('components/AppTopBar.tsx'),
  ]);

  assert.ok(app.includes('<OfflineStatusBanner>'));
  assert.ok(banner.includes('const { banner } = useNetworkStatus()'));
  assert.ok(banner.includes('SafeAreaInsetsContext.Provider'));
  assert.ok(banner.includes('px-lg py-xs'));
  assert.ok(banner.includes('insets.top > 32 ? insets.top - 10 : insets.top'));
  // Offline is derived from connectivity, so the banner persists instead of timing out.
  assert.ok(network.includes('state !== null && isOffline ? { message: OFFLINE_BANNER_MESSAGE'));
  assert.equal(network.includes('showOfflineNotice'), false);
  assert.equal(topBar.includes('banner'), false);
});

test('connectivity transitions and attempted offline actions use the auto-dismissing bottom snackbar', async () => {
  const [toast, network] = await Promise.all([
    source('components/GlobalConnectivityToast.tsx'),
    source('contexts/NetworkContext.tsx'),
  ]);

  assert.ok(toast.includes('BOTTOM_NAV_CLEARANCE'));
  assert.ok(toast.includes('bottom: insets.bottom + BOTTOM_NAV_CLEARANCE'));
  assert.equal(toast.includes('top: insets.top'), false);
  assert.ok(network.includes('TOAST_DISMISS_MS = 4000'));
  assert.ok(network.includes('dismissToast'));
});

test('stale notices clear on refresh, reconnect and edit', async () => {
  const [network, pillar, dashboard, tdee] = await Promise.all([
    source('contexts/NetworkContext.tsx'),
    source('components/PillarScreen.tsx'),
    source('screens/DashboardScreen.tsx'),
    source('screens/subscreens/TDEECalculatorScreen.tsx'),
  ]);

  assert.ok(network.includes("current && current.tone !== 'online' ? null : current"));
  assert.ok(pillar.includes('dismissToast();'));
  assert.ok(pillar.includes('onRefresh={handleRefresh}'));
  assert.ok(dashboard.includes('dismissToast();'));
  assert.ok(tdee.includes('const editField = useCallback('));
});

test('form validation and submission errors render inline, never in the banner or snackbar', async () => {
  const inlineScreens = [
    'screens/subscreens/TDEECalculatorScreen.tsx',
    'screens/subscreens/MealPlannerScreen.tsx',
    'screens/subscreens/AIWorkoutScreen.tsx',
    'screens/subscreens/CreateCommunityPostScreen.tsx',
    'screens/subscreens/CommunityPostThreadScreen.tsx',
    'screens/subscreens/JournalScreen.tsx',
    'screens/subscreens/DadDaysSearchScreen.tsx',
    'screens/subscreens/MilestoneTrackerScreen.tsx',
    'screens/subscreens/SharedCalendarScreen.tsx',
    'screens/subscreens/WeeklyChallengeScreen.tsx',
    'screens/subscreens/HealthPermissionsScreen.tsx',
    'screens/subscreens/ProSubscriptionScreen.tsx',
    'components/dashboard/CheckInPanel.tsx',
    'components/fitness/ActiveWorkout.tsx',
  ];
  const files = await Promise.all(inlineScreens.map(source));

  for (let index = 0; index < files.length; index += 1) {
    assert.ok(
      files[index].includes('<InlineFormError'),
      `Missing inline form error slot in ${inlineScreens[index]}`,
    );
  }

  const inline = await source('components/InlineFormError.tsx');
  assert.ok(inline.includes('accessibilityRole="alert"'));
  assert.ok(inline.includes("surface = 'dark'"));
});

test('screen-level load failures render inline and are suppressed while offline', async () => {
  const [reporter, screenNotice, fitness, weekly, calendar, journal, planner] = await Promise.all([
    source('components/GlobalErrorToastReporter.tsx'),
    source('components/ScreenErrorNotice.tsx'),
    source('screens/FitnessScreen.tsx'),
    source('screens/subscreens/WeeklyChallengeScreen.tsx'),
    source('screens/subscreens/SharedCalendarScreen.tsx'),
    source('screens/subscreens/JournalScreen.tsx'),
    source('screens/subscreens/MealPlannerScreen.tsx'),
  ]);

  assert.ok(reporter.includes('<InlineFormError message={isOffline ? null : message} />'));
  assert.ok(screenNotice.includes('<InlineFormError message={isOffline ? null : message} />'));
  assert.ok(fitness.includes('<GlobalErrorToastReporter message={fitnessLibrary.error} />'));
  assert.ok(weekly.includes('<GlobalErrorToastReporter message={loadError} />'));
  assert.ok(calendar.includes('<GlobalErrorToastReporter message={loadError} />'));
  assert.ok(journal.includes('<GlobalErrorToastReporter message={journal.syncError ?? journal.error} />'));
  assert.ok(planner.includes('<GlobalErrorToastReporter message={library.error ?? library.proError} />'));
});

test('network-only feature actions use connectivity notices rather than feature failure text offline', async () => {
  const guardedActions = [
    ['screens/subscreens/AIWorkoutScreen.tsx', "showOfflineAction('ai_workout')"],
    ['screens/subscreens/CookTogetherScreen.tsx', 'showOfflineAction("cook_together")'],
    ['screens/subscreens/MealPlannerScreen.tsx', "showOfflineAction('meal_plan')"],
    ['screens/subscreens/MilestoneTrackerScreen.tsx', "showOfflineAction('milestone_update')"],
    ['screens/subscreens/NotificationSettingsScreen.tsx', "showOfflineAction('notification_settings')"],
    ['screens/subscreens/ProfileScreen.tsx', "showOfflineAction('profile_photo')"],
    ['screens/subscreens/ProSubscriptionScreen.tsx', "showOfflineAction('subscriptions')"],
    ['screens/subscreens/SharedCalendarScreen.tsx', 'showOfflineAction("shared_calendar")'],
    ['screens/subscreens/TherapistDirectoryScreen.tsx', "showOfflineAction('therapist_booking')"],
    ['components/fitness/ActiveWorkout.tsx', "showOfflineAction('workout_log')"],
  ];

  for (const [path, expectedGuard] of guardedActions) {
    const file = await source(path);
    assert.ok(file.includes(expectedGuard), `Missing offline action guard in ${path}`);
    assert.equal(file.includes('showErrorNotice'), false, `Global feature error remains in ${path}`);
  }
});

test('Body and Bond features compose as flat sections instead of bordered cards', async () => {
  const [fitness, bond] = await Promise.all([
    source('screens/FitnessScreen.tsx'),
    source('screens/BondScreen.tsx'),
  ]);

  // label → heading → supporting copy → action → divider
  assert.ok(fitness.includes('border-b border-border pb-lg'));
  for (const feature of ['Free workout', 'Meal planner']) {
    assert.ok(fitness.includes(feature), `Missing Body feature label: ${feature}`);
  }
  assert.equal(fitness.includes('rounded-card'), false);
  assert.equal(fitness.includes("from '../components/Card'"), false);

  assert.ok(bond.includes('function BondFeatureSection'));
  assert.ok(bond.includes('border-b border-border pb-lg'));
  assert.equal(bond.includes('PillarCard'), false);
});

test('the bottom navigation is untouched', async () => {
  const tabs = await source('navigation/BottomTabNavigator.tsx');

  for (const route of ['Fit', 'Mind', 'Home', 'Bond', 'Squad']) {
    assert.ok(tabs.includes(`name="${route}"`), `Missing bottom tab route: ${route}`);
  }
  assert.ok(tabs.includes('tabBar={(props) => <MockupTabBar {...props} />}'));
});
