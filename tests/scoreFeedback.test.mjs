import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('successful and queued check-ins explain the Mind score connection', async () => {
  const source = await readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8');

  assert.match(source, /Check-in saved\. This check-in contributes to your Mind score\./);
  assert.match(source, /Once synced, this check-in contributes to your Mind score\./);
});

test('completed workout feedback explains the Body score connection', async () => {
  const source = await readFile(new URL('components/fitness/ActiveWorkout.tsx', root), 'utf8');

  assert.match(source, /Session logged\. This workout contributes to your Body score\./);
  assert.match(source, /setTimeout\(\(\) => setMessage\(null\), 3000\)/);
});

test('completed Cook Together recipes visibly confirm their Bond result', async () => {
  const [screen, hook] = await Promise.all([
    readFile(new URL('screens/subscreens/CookTogetherScreen.tsx', root), 'utf8'),
    readFile(new URL('hooks/useCookTogetherRecipes.ts', root), 'utf8'),
  ]);

  assert.match(hook, /supabase\.rpc\('complete_cook_together_recipe'/);
  assert.match(screen, /Recipe complete/);
  assert.match(screen, /was added to your Bond activity/);
  assert.match(screen, /active minutes logged/);
  assert.match(screen, /Your Bond score is now \{recipeData\.bondScore\}/);
  assert.match(screen, /setCompletion\(\{ title: recipe\.title, activeMinutes: recipe\.prep_mins \}\)/);
  assert.match(screen, /setTimeout\(\(\) => setCompletion\(null\), 30_000\)/);
  assert.match(screen, /clearTimeout\(timer\)/);
  assert.match(screen, /void refreshDashboard\(\)/);
});
