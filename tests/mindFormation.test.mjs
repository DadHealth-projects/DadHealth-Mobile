import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Mind shows facts and sleep after the feeling description, keeps weekly mood insights after actions', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');

  const feeling = source.indexOf('How are you feeling');
  const description = source.indexOf('Opening up about feelings');
  const statistics = source.indexOf('<StatTile value="1 in 8"');
  const sleep = source.indexOf('title="Sleep quality this week"');
  const breathing = source.indexOf('title="4-4-4 Breathing"');
  const journal = source.indexOf('title="Journal"');
  const therapist = source.indexOf('title="Find a therapist"');
  const community = source.indexOf('title="Community"');
  const mood = source.indexOf('<MoodWeekCard');
  const correlation = source.indexOf('title="Mood correlation"');

  assert.ok(feeling >= 0);
  assert.ok(feeling < description);
  assert.ok(description < statistics);
  assert.ok(statistics < sleep);
  assert.ok(sleep < breathing);
  assert.ok(breathing < journal);
  assert.ok(journal < therapist);
  assert.ok(therapist < community);
  assert.ok(community < mood);
  assert.ok(mood < correlation);
});

test('Mind keeps the existing action routes', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');

  assert.match(source, /eyebrow="2 minutes"[\s\S]*?navigate\('BreathingSession'\)/);
  assert.match(source, /eyebrow="Private journal"[\s\S]*?navigate\('Journal'\)/);
  assert.match(source, /eyebrow="Talk to someone"[\s\S]*?navigate\('TherapistDirectory'\)/);
  assert.match(source, /eyebrow="I just need to talk"[\s\S]*?navigate\('CommunityFeed'\)/);
});

test('Mood This Week is available to Free and View Mood Trends remains the Pro entry point', async () => {
  const [source, locks] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('lib/proMoments.ts', root), 'utf8'),
  ]);

  assert.match(source, /!data\?\.isPro/);
  assert.match(source, /navigation\.navigate\('ProSubscription'\)/);
  assert.match(source, /actionLabel={!data\?\.isPro \? 'View mood trends' : undefined}/);
  assert.match(await readFile(new URL('components/dashboard/MoodWeekCard.tsx', root), 'utf8'), /maxValue=\{5\}/);
  assert.match(locks, /moodTrends: \{/);
});

test('weekly sleep and mood correlation use Monday-Sunday keys and normalize legacy mood values', async () => {
  const hook = await readFile(new URL('hooks/useProgressSleep.ts', root), 'utf8');
  assert.match(hook, /getCurrentWeekDayKeys\(\)/);
  assert.match(hook, /mood_scale_version/);
  assert.match(hook, /mood_scale_version === 1 \? 0 : 1/);
  assert.match(hook, /day\.hours >= 7/);
});

test('Free sees a locked preview for mood correlation and Pro sees the pattern', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');
  assert.match(source, /data\?\.isPro \? \([\s\S]*?sleepInsights\.pattern/);
  assert.match(source, /Unlock mood correlation and pattern insights with Pro/);
});

test('Mind offers the Pro personalised plan without gating the free actions', async () => {
  const [source, locks, therapist] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('lib/proMoments.ts', root), 'utf8'),
    readFile(new URL('screens/subscreens/TherapistDirectoryScreen.tsx', root), 'utf8'),
  ]);

  assert.match(source, /moment=\{PRO_LOCKS\.mindPlan\}/);
  assert.match(locks, /Get a personalised plan/);
  // Brief free column: breathing, journal, therapist directory and crisis.
  assert.doesNotMatch(therapist, /isPro/);
  assert.doesNotMatch(therapist, /ProSubscription/);
});
