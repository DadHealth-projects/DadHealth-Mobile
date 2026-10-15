import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Mind puts approved actions before scores, logging and education', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');

  const feeling = source.indexOf('How are you feeling');
  const description = source.indexOf('Opening up about feelings');
  const mindReset = source.indexOf('title="Mind Reset"');
  const quickFixes = source.indexOf('<MindQuickFixes');
  const mindPlan = source.indexOf('<MindPlanLockedCard');
  const journal = source.indexOf('title="Journal"');
  const therapist = source.indexOf('title="Find a therapist"');
  const community = source.indexOf('title="Community"');
  const mood = source.indexOf('<MoodWeekCard');
  const correlation = source.indexOf('title="Mood correlation"');
  const manual = source.indexOf('<ManualActivitySection');
  const statistics = source.indexOf('<StatTile value="1 in 8"');

  assert.ok(feeling >= 0);
  assert.ok(feeling < description);
  assert.ok(description < mindReset);
  assert.ok(mindReset < quickFixes);
  assert.ok(quickFixes < mindPlan);
  assert.ok(mindPlan < journal);
  assert.ok(journal < therapist);
  assert.ok(therapist < community);
  assert.ok(community < mood);
  assert.ok(mood < correlation);
  assert.ok(correlation < manual);
  assert.ok(manual < statistics);
});

test('Mind keeps the existing action routes', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');

  assert.match(source, /eyebrow="5 minutes"[\s\S]*?title="Mind Reset"[\s\S]*?navigate\('BreathingSession'\)/);
  assert.match(source, /<MindQuickFixes\s*\/>/);
  assert.match(source, /eyebrow="Private journal"[\s\S]*?navigate\('Journal'\)/);
  assert.match(source, /eyebrow="Talk to someone"[\s\S]*?navigate\('TherapistDirectory'\)/);
  assert.match(source, /eyebrow="I just need to talk"[\s\S]*?navigate\('CommunityFeed'\)/);
});

test('Mood This Week is available to Free and View Mood Trends remains the Pro entry point', async () => {
  const [source, locks] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('lib/proMoments.ts', root), 'utf8'),
  ]);

  assert.match(source, /data\?\.isPro === false/);
  assert.match(source, /navigation\.navigate\('ProSubscription'\)/);
  assert.match(source, /actionLabel={data\?\.isPro === false \? 'View mood trends' : undefined}/);
  assert.match(await readFile(new URL('components/dashboard/MoodWeekCard.tsx', root), 'utf8'), /maxValue=\{5\}/);
  assert.match(locks, /moodTrends: \{/);
});

test('weekly sleep and mood correlation use Monday-Sunday keys and normalize legacy mood values', async () => {
  const hook = await readFile(new URL('hooks/useProgressSleep.ts', root), 'utf8');
  assert.match(hook, /getCurrentWeekDayKeys\(\)/);
  assert.match(hook, /mood_scale_version/);
  assert.match(hook, /mood_scale_version === 1 \? 0 : 1/);
  assert.match(hook, /fetchProInsight<\{ pattern: string; weekStart: string; weekEnd: string \}>\('mood-correlation'\)/);
  assert.match(hook, /isPro\s*\?/);
});

test('Free sees a locked preview for mood correlation and Pro sees the pattern', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');
  assert.match(source, /data\?\.isPro === true \? \([\s\S]*?sleepInsights\.pattern/);
  assert.match(source, /data\?\.isPro === false \? \(/);
  assert.match(source, /Mood trend/);
  assert.match(source, /See your patterns/);
  assert.match(source, /Your mood over 4 weeks, and what moves it\./);
  assert.match(source, /View my trends/);
  assert.match(source, /name="crown"/);
});

test('Mind offers the Pro personalised plan without gating the free actions', async () => {
  const [source, locks, therapist] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('lib/proMoments.ts', root), 'utf8'),
    readFile(new URL('screens/subscreens/TherapistDirectoryScreen.tsx', root), 'utf8'),
  ]);

  assert.match(source, /<MindPlanLockedCard[\s\S]*?onUnlock=\{\(\) => navigation\.navigate\('ProSubscription'\)\}/);
  assert.match(locks, /Get a personalised plan/);
  // Brief free column: breathing, journal, therapist directory and crisis.
  assert.doesNotMatch(therapist, /isPro/);
  assert.doesNotMatch(therapist, /ProSubscription/);
});
