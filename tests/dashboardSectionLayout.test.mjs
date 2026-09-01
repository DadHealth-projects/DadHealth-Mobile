import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('Today keeps its approved lime score and check-in surfaces', async () => {
  const [today, score] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/DadScoreCard.tsx'),
  ]);

  assert.ok(today.includes('bg-lime rounded-card px-xl py-xl'));
  assert.ok(score.includes('bg-lime rounded-t-[18px]'));
  assert.equal(today.includes('scoreLabel="of 100" flat'), false);
});

test('Body uses divider-led sections instead of tall dark cards', async () => {
  const [body, stats, account] = await Promise.all([
    source('screens/FitnessScreen.tsx'),
    source('components/dashboard/StatCard.tsx'),
    source('components/AccountSheet.tsx'),
  ]);

  assert.equal(body.includes("import Card from '../components/Card'"), false);
  assert.ok(body.includes('function FlatSection'));
  assert.ok(body.includes('border-b border-border pb-lg'));
  assert.equal(body.includes('border-y border-border py-lg'), false);
  assert.ok(body.includes('<StatCard value={stats[0].value} label={stats[0].label} />'));
  assert.ok(stats.includes('rounded-card border border-lime/20 bg-card p-md'));
  assert.equal(body.includes('<Card'), false);
  assert.ok(body.includes("headline={'Body\\nand nutrition'}"));
  assert.ok(body.includes('<ScreenHero eyebrow="Body"'));
  assert.ok(account.includes("title: 'Body', section: 'FITNESS'"));
  assert.ok(body.indexOf('<SectionHeader title="Body this week"') < body.indexOf('<StatCard value={stats[0].value}'));
  assert.ok(body.indexOf('{workoutSummary}') > body.indexOf('<SectionHeader title="Body this week"'));
  assert.ok(body.indexOf('{workoutSummary}') < body.indexOf('<StatCard value={stats[0].value}'));
  assert.ok(body.indexOf('<SectionHeader title="Body this week"') < body.indexOf('Active workout'));
});

test('Mind preserves compact information and feature cards while flattening the tall mood panel', async () => {
  const mind = await source('screens/MindScreen.tsx');

  assert.ok(mind.includes('<StatTile value="1 in 8"'));
  assert.ok(mind.includes('summary={moodSummary} flat'));
  assert.ok(mind.includes("rounded-button border px-md py-md ${featured ? 'border-lime/25 bg-lime/5' : 'border-border bg-card'}"));
  assert.ok(mind.includes('gap-md border-b border-border pb-md'));
});

test('Bond keeps its existing green score and compact action cards', async () => {
  const bond = await source('screens/BondScreen.tsx');

  assert.ok(bond.includes('<BondScoreCard'));
  assert.ok(bond.includes('border border-lime/25 bg-lime/5'));
  assert.ok(bond.includes('rounded-button border border-lime/25 bg-card px-md py-md'));
  assert.equal(bond.includes('\n          flat'), false);
});

test('Community keeps its compact circle tiles and recent-post row', async () => {
  const community = await source('screens/CommunityScreen.tsx');

  assert.ok(community.includes('<CircleCard'));
  assert.ok(community.includes('className="w-[48%]"'));
  assert.ok(community.includes('min-h-[76px] flex-row items-center gap-md rounded-button border border-border bg-card px-md'));
});
