import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screen = await readFile(new URL('../screens/FitnessScreen.tsx', import.meta.url), 'utf8');
const card = await readFile(new URL('../components/body/BodyProLockedCard.tsx', import.meta.url), 'utf8');
const library = await readFile(new URL('../hooks/useFitnessLibrary.ts', import.meta.url), 'utf8');

test('Free Body cards lock AI generation; confirmed Pro and Trial retain feature actions', () => {
  assert.match(screen, /aiWorkoutAccess === true \?/);
  assert.match(screen, /aiWorkoutAccess === false \?/);
  assert.match(screen, /mealPlannerAccess === true \?/);
  assert.match(screen, /mealPlannerAccess === false \?/);
  assert.match(screen, /entitlement\.trialActive === true \? <ProBadge variant="trial" \/>/);
  assert.doesNotMatch(screen, /Unlimited|3 free \/ month/);
});

test('locked Body cards use a shared Pro badge and static local preview art', () => {
  assert.match(card, /ProBadge/);
  assert.match(card, /Image/);
  assert.match(card, /accessibilityLabel=\{previewLabel\}/);
  assert.match(card, /border-lime\/40/);
  assert.match(screen, /body-ai-workout-blurred-preview\.png/);
  assert.match(screen, /body-meal-planner-blurred-preview\.png/);
});

test('logged-out Body shows blurred AI and meal previews without claiming a Free lock', () => {
  assert.match(screen, /const aiWorkoutAccess = hasUser \? entitlement\.can\('ai_workout'\) : null/);
  assert.match(screen, /const mealPlannerAccess = hasUser \? entitlement\.can\('meal_planner'\) : null/);
  assert.match(screen, /\) : !hasUser \? \([\s\S]*?body-ai-workout-blurred-preview\.png[\s\S]*?Log in to continue/);
  assert.match(screen, /\) : !hasUser \? \([\s\S]*?body-meal-planner-blurred-preview\.png[\s\S]*?Log in to continue/);
  assert.match(screen, /trackLockView=\{false\}/);
  assert.match(card, /trackLockView\?: boolean/);
});

test('existing workouts remain in the library for Free and Pro users', () => {
  assert.match(library, /workouts: \[\.\.\.generatedWorkouts, \.\.\.adminWorkouts\]/);
});
