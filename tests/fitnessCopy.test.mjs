import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Fitness uses the selected workout name, move count, duration and equipment', async () => {
  const source = await readFile(new URL('screens/FitnessScreen.tsx', root), 'utf8');

  assert.match(source, /const workoutName = selectedWorkout\?\.title\.trim\(\) \|\| 'Dad Strength'/);
  assert.match(source, /`\$\{workoutName\} · \$\{moveCountLabel\} · \$\{selectedWorkout\.duration_mins\} min`/);
  assert.match(source, /EQUIPMENT_LABEL\[selectedWorkout\.equipment\]/);
  assert.match(source, /sub=\{workoutSummary\}/);
  assert.match(source, /\{workoutName\}/);
  assert.match(source, /\{workoutMeta\}/);
  assert.doesNotMatch(source, /workout \+ meal planner hub/i);
});

test('Fitness move counts use correct singular and plural copy', async () => {
  const [fitness, activeWorkout] = await Promise.all([
    readFile(new URL('screens/FitnessScreen.tsx', root), 'utf8'),
    readFile(new URL('components/fitness/ActiveWorkout.tsx', root), 'utf8'),
  ]);

  for (const source of [fitness, activeWorkout]) {
    assert.match(source, /count === 1 \? 'move' : 'moves'/);
  }
  assert.doesNotMatch(fitness, /\$\{moveCount\} moves/);
  assert.doesNotMatch(activeWorkout, /\$\{moves\.length\} moves/);
});

test('successful workout log confirmation dismisses after a few seconds', async () => {
  const source = await readFile(new URL('components/fitness/ActiveWorkout.tsx', root), 'utf8');

  assert.match(source, /messageTone !== 'success'/);
  assert.match(source, /setTimeout\(\(\) => setMessage\(null\), 3000\)/);
  assert.match(source, /clearTimeout\(timeout\)/);
});

test('Fitness replaces missing-data zeros with useful onboarding prompts', async () => {
  const [fitness, summary] = await Promise.all([
    readFile(new URL('screens/FitnessScreen.tsx', root), 'utf8'),
    readFile(new URL('hooks/useFitnessSummary.ts', root), 'utf8'),
  ]);

  for (const prompt of ['Start one', 'Log yours', 'Connect', 'Get moving']) {
    assert.match(fitness, new RegExp(prompt));
  }
  assert.match(summary, /weightDisplay: null/);
  assert.match(summary, /stepsDisplay: null/);
  assert.match(summary, /activeDisplay: null/);
  assert.match(summary, /latestWeight != null[\s\S]*?`\$\{latestWeight\}kg`/);
  assert.doesNotMatch(summary, /weightDisplay: '0'/);
  assert.doesNotMatch(summary, /stepsDisplay: '0'/);
  assert.doesNotMatch(summary, /activeDisplay: '0 min'/);
});
