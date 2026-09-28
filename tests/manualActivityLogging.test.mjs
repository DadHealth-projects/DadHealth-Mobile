import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('manual logger provides the approved Body, Bond and Mind activities', async () => {
  const source = await read('lib/manualActivities.ts');
  const screen = await read('screens/subscreens/ManualActivityLogScreen.tsx');
  for (const label of ['CrossFit', 'Running', 'Martial arts', 'School run', 'Bedtime routine', 'Mini Partners session', 'FaceTime', 'Therapy', 'CBT session', 'Meditation', 'Met a friend', 'Time outdoors']) {
    assert.ok(source.includes(label), `missing option ${label}`);
  }
  assert.match(source, /Other activity/);
  assert.match(screen, /Contact day/);
});

test('form validates Body and Mind durations, Body intensity, and keeps Bond duration optional', async () => {
  const source = await read('lib/manualActivities.ts');
  const screen = await read('screens/subscreens/ManualActivityLogScreen.tsx');
  assert.match(source, /draft\.pillar === 'body'.*durationMinutes/);
  assert.match(source, /draft\.pillar === 'body' && !draft\.intensity/);
  assert.match(source, /draft\.pillar === 'mind'.*durationMinutes/);
  assert.match(screen, /Activities under 5 minutes don’t contribute to your score/);
  assert.match(screen, /Activities under 15 minutes don’t contribute to your score/);
  assert.match(screen, /DateTimePicker[\s\S]*minimumDate[\s\S]*maximumDate/);
});

test('plus LOG and all pillar screens route into the shared logger', async () => {
  const [tabs, app, body, bond, mind] = await Promise.all([
    read('navigation/BottomTabNavigator.tsx'), read('navigation/AppNavigator.tsx'),
    read('screens/FitnessScreen.tsx'), read('screens/BondScreen.tsx'), read('screens/MindScreen.tsx'),
  ]);
  for (const pillar of ['body', 'bond', 'mind']) assert.ok(tabs.includes(`pillar: '${pillar}'`));
  assert.match(app, /name="ManualActivityLog"/);
  assert.match(body, /ManualActivitySection pillar="body"/);
  assert.match(bond, /ManualActivitySection pillar="bond"/);
  assert.match(mind, /ManualActivitySection pillar="mind"/);
});

test('Mini Partners prompt/link and one-row idempotent write are preserved', async () => {
  const screen = await read('screens/subscreens/ManualActivityLogScreen.tsx');
  const service = await read('lib/manualActivities.ts');
  assert.match(screen, /Not a Mini Partners member\? Find out more at dadhealth\.co\.uk\/minipartners/);
  assert.match(screen, /https:\/\/dadhealth\.co\.uk\/minipartners/);
  assert.match(service, /client_request_id: clientRequestId/);
  assert.match(service, /eq\('client_request_id', clientRequestId\)/);
  assert.match(service, /same client request after a lost response/);
});

test('manual activity history is Free while derived weekly trend uses the Pro endpoint', async () => {
  const history = await read('screens/subscreens/ManualActivityHistoryScreen.tsx');
  const service = await read('lib/manualActivities.ts');
  assert.match(service, /from\('activity_logs'\)[\s\S]*?eq\('user_id', userId\)/);
  assert.match(history, /fetchProInsight[\s\S]*manual-activity-trends/);
  assert.match(history, /PRO_MOMENTS\.progressTrends/);
});
