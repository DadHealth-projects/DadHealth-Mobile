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

  assert.ok(feeling >= 0);
  assert.ok(feeling < crisis);
  assert.ok(crisis < breathing);
  assert.ok(breathing < journal);
  assert.ok(journal < therapist);
  assert.ok(therapist < community);
  assert.ok(community < mood);
  // The screen finishes on support and the member's own information. The paired
  // statistic-card block was removed and must not come back as filler.
  assert.equal(source.includes('<StatTile'), false);
});

test('Mind reuses real routes without presenting missing products', async () => {
  const source = await readFile(new URL('screens/MindScreen.tsx', root), 'utf8');

  assert.match(source, /eyebrow="2 minutes"[\s\S]*?navigate\('BreathingSession'\)/);
  assert.match(source, /eyebrow="Private journal"[\s\S]*?navigate\('Journal'\)/);
  assert.match(source, /eyebrow="Talk to someone"[\s\S]*?navigate\('TherapistDirectory'\)/);
  assert.match(source, /eyebrow="I just need to talk"[\s\S]*?navigate\('CommunityFeed'\)/);
  assert.doesNotMatch(source, /Reset Exercise|Guided Reflection|personalised plan/i);
});

test('free users get a locked mood-trend preview rather than a bare lock', async () => {
  const [source, card, chart] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('components/dashboard/MoodWeekCard.tsx', root), 'utf8'),
    readFile(new URL('components/dashboard/MiniBarChart.tsx', root), 'utf8'),
  ]);

  // Entitlement is unchanged — the trend still belongs to Pro.
  assert.match(source, /!data\?\.isPro/);
  assert.match(source, /navigation\.navigate\('ProSubscription'\)/);
  // The chart is previewed in place instead of being replaced by a lock panel.
  assert.match(source, /<MoodWeekCard[\s\S]*?flat locked/);
  assert.match(source, /See your seven-day trend/);
  // The preview draws empty tracks — never a value that reads as the member's own.
  assert.match(card, /lockedAccessibilityLabel="Seven-day mood trend, locked"/);
  assert.match(card, /Avg mood:[\s\S]*?locked \?[\s\S]*?Locked/);
  const preview = /if \(locked\) \{([\s\S]*?)\n  \}/.exec(chart)?.[1] ?? '';
  assert.ok(preview.length > 0);
  assert.doesNotMatch(preview, /values|maxValue|barHeight/);
});
