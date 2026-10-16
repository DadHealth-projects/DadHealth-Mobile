import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobile = new URL('../', import.meta.url);
const backend = new URL('../../dadHealth/', import.meta.url);
const readMobile = (path) => readFile(new URL(path, mobile), 'utf8');
const readBackend = (path) => readFile(new URL(path, backend), 'utf8');

test('dashboard resume keeps verified access during refresh and clears it on verification failure', async () => {
  const source = await readMobile('hooks/useDashboard.ts');
  const refresh = source.slice(source.indexOf('export function refreshDashboardForUser'), source.indexOf('export function useDashboard'));
  const resume = source.slice(source.indexOf("AppState.addEventListener('change'"), source.indexOf('subscribeOfflineSync'));
  assert.doesNotMatch(refresh, /markDashboardEntitlementUnknown/);
  assert.doesNotMatch(resume, /markDashboardEntitlementUnknown/);
  assert.match(source, /if \(!store\.data && !store\.loading\) void loadDashboard\(userId\)/);
  assert.match(source, /isPro: null,[\s\S]*?trialActive: null/);
  assert.match(source, /const fallback = cached && typeof cached === 'object' \? cached : current/);
});

test('AI Workout mobile blocks Free and unknown generation, and preserves old workouts', async () => {
  const [screen, client] = await Promise.all([
    readMobile('screens/subscreens/AIWorkoutScreen.tsx'),
    readMobile('lib/aiWorkout.ts'),
  ]);
  assert.match(screen, /if \(aiWorkoutAccess === false\)[\s\S]*?openPro\(\)/);
  assert.match(screen, /if \(aiWorkoutAccess !== true\) return/);
  assert.match(screen, /aiWorkoutAccess === false \?[\s\S]*?ProUpgradeSection/);
  assert.match(screen, /displayedWorkout \? \([\s\S]*?GeneratedWorkoutSection/);
  assert.doesNotMatch(screen + client, /3 free \/ month|free_limit_reached/);
});

test('AI Workout API uses canonical entitlement and denies Free before generation', async () => {
  const route = await readBackend('src/app/api/generate-workout/route.ts');
  assert.match(route, /getSubscriptionSummary\(admin, user\.id\)/);
  assert.match(route, /if \(!isPro\)[\s\S]*?"pro_required"[\s\S]*?403/);
  assert.match(route, /source: "ai_generated"/);
  assert.doesNotMatch(route, /isProfilePro|FREE_MONTHLY_GENERATIONS|claim_ai_workout_generation|complete_ai_workout_generation/);
});

test('Meal Planner API is Pro-only for generation and securely returns the user saved plan', async () => {
  const [route, screen] = await Promise.all([
    readBackend('src/app/api/generate-meal-plan/route.ts'),
    readMobile('screens/subscreens/MealPlannerScreen.tsx'),
  ]);
  assert.match(route, /export async function GET/);
  assert.match(route, /\.eq\('user_id', user\.id\)[\s\S]*?\.eq\('source', 'ai_generated'\)/);
  assert.match(route, /savedPlan: data \?\? null/);
  assert.match(route, /Cache-Control': 'private, no-store'/);
  assert.match(route, /getSubscriptionSummary\(createAdminSupabaseClient\(\), user\.id\)/);
  assert.match(route, /if \(!isPro\)[\s\S]*?code: 'pro_required'[\s\S]*?status: 403/);
  assert.doesNotMatch(route, /FREE_AI_MEAL_PLANS|meal_plan_limit_reached|free meal plans/i);
  assert.match(screen, /useFocusEffect/);
  assert.match(screen, /savedPlanRequest\.current \+= 1;[\s\S]*?setGenerating\(true\)/);
  assert.match(screen, /GET/);
  assert.match(screen, /setGeneratedPlan\(payload\.savedPlan \?\? null\)/);
  assert.match(screen, /generatedPlanUserId === user\?\.id \? generatedPlan : null/);
  assert.match(screen, /\{visiblePlan && displayedDay \? \(/);
  assert.match(screen, /mealPlannerAccess === false \?/);
});

test('Expo Go skips native IAP loading while server entitlement refresh remains first', async () => {
  const [native, hook] = await Promise.all([
    readMobile('lib/nativeSubscriptions.ts'),
    readMobile('hooks/useNativeSubscriptions.ts'),
  ]);
  assert.match(native, /shouldLoadNativeIap\(appOwnership: string \| null\)/);
  assert.match(native, /shouldLoadNativeIap\(Constants\.appOwnership\)/);
  assert.match(native, /cachedIap = null;[\s\S]*?return cachedIap;[\s\S]*?require\('react-native-iap'\)/);
  assert.match(hook, /await refreshStatus\(\);[\s\S]*?if \(!iap/);
});

test('Pro score details stay available separately from the gated Weekly Report', async () => {
  const [details, weekly] = await Promise.all([
    readMobile('components/dashboard/ScoreDetailSheet.tsx'),
    readMobile('components/dashboard/WeeklyReportCard.tsx'),
  ]);
  assert.match(details, /useDashboard|Dad Health Score|Score details/i);
  assert.match(weekly, /reportAccess === false/);
});
