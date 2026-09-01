import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Mind is action-first and keeps statistics below the existing actions', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');

  const feeling = source.indexOf('How are you feeling');
  const crisis = source.indexOf('<CrisisSupportRow />');
  const breathing = source.indexOf('title="4-4-4 Breathing"');
  const journal = source.indexOf('title="Journal"');
  const therapist = source.indexOf('title="Find a therapist"');
  const community = source.indexOf('title="Community"');
  const mood = source.indexOf('title="Login required"');
  const statistics = source.indexOf('<StatTile value="1 in 8"');

  assert.ok(feeling >= 0);
  assert.ok(feeling < crisis);
  assert.ok(crisis < breathing);
  assert.ok(breathing < journal);
  assert.ok(journal < therapist);
  assert.ok(therapist < community);
  assert.ok(community < mood);
  assert.ok(mood < statistics);
});

test('Mind reuses real routes without presenting missing products', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');

  assert.match(source, /eyebrow="2 minutes"[\s\S]*?navigate\('BreathingSession'\)/);
  assert.match(source, /eyebrow="Private journal"[\s\S]*?navigate\('Journal'\)/);
  assert.match(source, /eyebrow="Talk to someone"[\s\S]*?navigate\('TherapistDirectory'\)/);
  assert.match(source, /eyebrow="I just need to talk"[\s\S]*?navigate\('CommunityFeed'\)/);
  assert.doesNotMatch(source, /Reset Exercise|Guided Reflection|personalised plan/i);
});

test('free users retain the locked mood-trend preview', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');

  assert.match(source, /!data\?\.isPro/);
  assert.match(source, /Seven-day mood trends are included with Dad Health Pro\./);
  assert.match(source, /navigation\.navigate\('ProSubscription'\)/);
  assert.match(source, /<MoodWeekCard[\s\S]*?flat/);
});
