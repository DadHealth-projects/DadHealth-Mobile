import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screen = await readFile(new URL('../screens/FitnessScreen.tsx', import.meta.url), 'utf8');
const card = await readFile(new URL('../components/body/BodyProLockedCard.tsx', import.meta.url), 'utf8');
const library = await readFile(new URL('../hooks/useFitnessLibrary.ts', import.meta.url), 'utf8');

test('Free Body cards link to Pro locks; Pro cards keep existing actions', () => {
  assert.match(screen, /fitnessLibrary\.isPro \? \([\s\S]*?onPress=\{openAIWorkout\}[\s\S]*?\) : \([\s\S]*?buttonLabel="Unlock AI workouts →"[\s\S]*?navigation\.navigate\('ProSubscription'\)/);
  assert.match(screen, /fitnessLibrary\.isPro \? \([\s\S]*?onPress=\{openMealPlanner\}[\s\S]*?\) : \([\s\S]*?buttonLabel="Unlock meal planner →"[\s\S]*?navigation\.navigate\('ProSubscription'\)/);
  assert.doesNotMatch(screen, /Unlimited|3 free \/ month|Preview/);
});

test('locked Body cards use a shared Pro badge and static local preview art', () => {
  assert.match(card, /ProBadge/);
  assert.match(card, /Image/);
  assert.match(card, /accessibilityLabel=\{previewLabel\}/);
  assert.match(card, /border-lime\/40/);
  assert.match(screen, /body-ai-workout-blurred-preview\.png/);
  assert.match(screen, /body-meal-planner-blurred-preview\.png/);
});

test('existing workouts remain in the library for Free and Pro users', () => {
  assert.match(library, /setWorkouts\(\[\.\.\.generatedWorkouts, \.\.\.adminWorkouts\]\)/);
});
