import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fitness = await readFile(new URL('../screens/FitnessScreen.tsx', import.meta.url), 'utf8');
const aiWorkout = await readFile(new URL('../screens/subscreens/AIWorkoutScreen.tsx', import.meta.url), 'utf8');
const activeWorkout = await readFile(new URL('../screens/subscreens/ActiveWorkoutScreen.tsx', import.meta.url), 'utf8');
const mealPlanner = await readFile(new URL('../screens/subscreens/MealPlannerScreen.tsx', import.meta.url), 'utf8');

test('Free Body library only includes the current weekly assignment', () => {
  assert.match(fitness, /workoutLibraryAccess === true[\s\S]*?fitnessLibrary\.workouts[\s\S]*?fitnessLibrary\.workouts\.filter\(\(workout\) => workout\.id === fitnessLibrary\.weeklyWorkout\?\.id\)/);
  assert.match(fitness, /aiWorkoutAccess === true[\s\S]*?workout\.source === 'ai_generated'/);
});

test('saved AI workouts require confirmed Pro access through both direct routes', () => {
  assert.match(aiWorkout, /aiWorkoutAccess === true[\s\S]*?library\.workouts\.find\(\(workout\) => workout\.id === route\.params\?\.workoutId\)/);
  assert.match(activeWorkout, /workout\?\.source === 'ai_generated' && aiWorkoutAccess !== true/);
  assert.match(activeWorkout, /lockedAiWorkout && aiWorkoutAccess === false[\s\S]*?ProUpgradeSection/);
});

test('saved meal plan stays hidden in Free, unknown and loading states', () => {
  assert.match(mealPlanner, /mealPlannerAccess === true && generatedPlanUserId === user\?\.id/);
  assert.match(mealPlanner, /!userId \|\| !accessToken \|\| mealPlannerAccess !== true/);
});
