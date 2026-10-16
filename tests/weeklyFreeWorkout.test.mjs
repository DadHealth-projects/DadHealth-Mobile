import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { selectWeeklyWorkout } from '../lib/weeklyWorkoutSelection.js';

const library = await readFile(new URL('../hooks/useFitnessLibrary.ts', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../hooks/useDashboard.ts', import.meta.url), 'utf8');
const body = await readFile(new URL('../screens/FitnessScreen.tsx', import.meta.url), 'utf8');
const active = await readFile(new URL('../screens/subscreens/ActiveWorkoutScreen.tsx', import.meta.url), 'utf8');
const today = await readFile(new URL('../screens/DashboardScreen.tsx', import.meta.url), 'utf8');

test('weekly workout comes from the server assignment, never newest-workout fallback', () => {
  assert.match(library, /from\('free_weekly_workout_assignments'\)/);
  assert.match(library, /setWeeklyWorkout\(selectWeeklyWorkout\(adminWorkouts, assignment\)\)/);
  assert.doesNotMatch(library, /loadNativeSubscriptionStatus/);
  assert.doesNotMatch(dashboard, /free_weekly_workout_assignments|suggestedWorkout/);
});

test('Free Body shows assigned workout and explicit empty state; Pro library remains full', () => {
  assert.match(body, /workoutLibraryAccess === true\s*\?/);
  assert.match(body, /fitnessLibrary\.weeklyWorkout\?\.id/);
  assert.match(body, /No workout has been assigned this week yet/);
  assert.match(body, /workoutLibraryAccess === false \? 'This week’s workout and saved workouts'/);
});

test('Today and Body select same assigned workout; Today opens its exact ID', () => {
  const assigned = { id: 'admin-weekly-1', exercises: Array.from({ length: 17 }) };
  const newerUnassigned = { id: 'newer-admin-workout', exercises: [] };
  assert.equal(selectWeeklyWorkout([newerUnassigned, assigned], { workout_id: assigned.id }), assigned);
  assert.equal(selectWeeklyWorkout([newerUnassigned, assigned], null), null);

  assert.match(today, /useFitnessLibrary\(user\.id\)/);
  assert.match(body, /useFitnessLibrary\(user\?\.id, standalone\)/);
  assert.match(today, /navigation\.navigate\('ActiveWorkout', \{ workoutId: weeklyWorkout\.id \}\)/);
  assert.doesNotMatch(today, /data\?\.suggestedWorkout/);
  assert.match(today, /else navigation\.navigate\('Tabs', \{ screen: 'Fit' \}\)/);
  assert.match(today, /No workout has been assigned this week yet/);
});

test('Today refresh reloads assignment and separates loading, unavailable, offline and failure', () => {
  assert.match(today, /refreshWeeklyWorkout\(\)/);
  assert.match(today, /workoutLoading/);
  assert.match(today, /workoutError/);
  assert.match(today, /assignmentKnown/);
  assert.match(today, /Connect to the internet to check this week/);
});

test('Active Workout never substitutes an arbitrary library entry', () => {
  assert.match(active, /find\(\(item\) => item\.id === route\.params\?\.workoutId\)/);
  assert.doesNotMatch(active, /library\.workouts\[0\]/);
});
