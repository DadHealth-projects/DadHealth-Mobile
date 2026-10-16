import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Today routes feature access through shared keys and keeps unknown state neutral', async () => {
  const [screen, followUp, streak, weekly] = await Promise.all([
    read('screens/DashboardScreen.tsx'),
    read('components/dashboard/CheckInFollowUp.tsx'),
    read('components/dashboard/StreakCard.tsx'),
    read('components/dashboard/WeeklyReportCard.tsx'),
  ]);

  for (const key of ['mind_plan', 'score_insights', 'weekly_report', 'streak_freeze']) {
    assert.match(screen, new RegExp(`can\\('${key}'\\)`));
  }
  assert.match(followUp, /planAccess !== null/);
  assert.match(streak, /freezeAccess === false && onUpgrade/);
  assert.match(streak, /freezeAccess === true/);
  assert.match(weekly, /reportAccess === null/);
  assert.match(screen, /scoreInsightsAccess === false \? 'Unlock my insights'/);
  assert.match(screen, /isWeeklyReportDay\(\)/);
});

test('Body cards use shared access while retaining Free workout and generated workout paths', async () => {
  const [body, ai, meal] = await Promise.all([
    read('screens/FitnessScreen.tsx'),
    read('screens/subscreens/AIWorkoutScreen.tsx'),
    read('screens/subscreens/MealPlannerScreen.tsx'),
  ]);

  for (const key of ['ai_workout', 'meal_planner', 'workout_library', 'trends']) {
    assert.match(body, new RegExp(`can\\('${key}'\\)`));
  }
  assert.match(body, /selectedWorkout\?\.id \? \{ workoutId: selectedWorkout\.id \}/);
  assert.match(body, /generatedWorkout \? \{ workoutId: generatedWorkout\.id \}/);
  assert.match(body, /aiWorkoutAccess === false \? \(/);
  assert.match(body, /mealPlannerAccess === false \? \(/);
  assert.match(ai, /can\('ai_workout'\)/);
  assert.match(ai, /aiWorkoutAccess === false \?/);
  assert.match(ai, /aiWorkoutAccess !== true/);
  assert.doesNotMatch(ai, /3 free \/ month|free_limit_reached/);
  assert.match(ai, /generateAIWorkout\(session\.access_token/);
  assert.match(meal, /can\('meal_planner'\)/);
  assert.match(meal, /mealPlannerAccess !== true/);
  assert.match(meal, /navigateToProSubscription\(navigation, 'meal_planner'/);
});
