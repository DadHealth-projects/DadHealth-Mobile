import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

test('canonical score query exposes server baseline status to all score views', async () => {
  const [hook, today, scoreDetail, mind, body, bond] = await Promise.all([
    source('hooks/useDashboard.ts'),
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/ScoreDetailSheet.tsx'),
    source('screens/MindScreen.tsx'),
    source('screens/FitnessScreen.tsx'),
    source('screens/BondScreen.tsx'),
  ]);

  assert.match(hook, /recommended_action,baseline_available/);
  assert.match(hook, /baselineAvailable: scoresResult\.data\?\.baseline_available === true/);
  assert.match(today, /baselineBuilding=\{!data\.scoreError && !data\.baselineAvailable\}/);
  assert.match(scoreDetail, /baselineBuilding=\{baselineBuilding\}/);
  assert.match(mind, /baselineBuilding=\{Boolean\(data && !data\.scoreError && !data\.baselineAvailable\)\}/);
  assert.match(body, /baselineBuilding=\{Boolean\(data && !data\.scoreError && !data\.baselineAvailable\)\}/);
  assert.match(bond, /baselineBuilding=\{Boolean\(data && !data\.scoreError && !data\.baselineAvailable\)\}/);
});

// Client-approved 2026-11-23: valid scores show from day one; only week-on-week
// trends (and the comparison-based warning) wait for the server baseline.
test('baseline state shows valid scores from day one and hides only trends', async () => {
  const [card, pillarRow, bondCard] = await Promise.all([
    source('components/dashboard/DadScoreCard.tsx'),
    source('components/dashboard/PillarScoreRow.tsx'),
    source('components/bond/BondScoreCard.tsx'),
  ]);

  for (const component of [card, pillarRow, bondCard]) {
    assert.ok(component.includes('Building first 7 day trend'));
    assert.match(component, /baselineBuilding/);
    assert.doesNotMatch(component, /baselineBuilding \? <Text[^>]*>·<\/Text>/, 'no placeholder dot replaces a valid score');
    assert.doesNotMatch(component, /score \?\? 0/, 'a missing score is never displayed as 0');
  }
  assert.match(card, /scoreUnavailable \? '—' : score \?\? missingScore/);
  // Card sizes re-pinned to the current values introduced in 7b4c355 (2026-11-07).
  assert.match(card, /scoreRingSize = compactWidth \? 108 : 120/);
  assert.match(card, /ringScoreFontSize = compactWidth \? 46 : 52/);
  assert.match(card, /adjustsFontSizeToFit/);
  assert.match(card, /compactWidth \? 'text-\[12px\]' : 'text-\[13px\]'/);
  assert.match(card, /!baselineBuilding && \(item\.trend != null \|\| item\.showNeutralTrend\)/);
  assert.match(card, /!baselineBuilding && item\.warning/);
  assert.match(card, /item\.value !== null && !scoreUnavailable/);
  assert.match(card, /formatScoreTrend\(item\.trend\)/);
  assert.match(pillarRow, /scoreUnavailable \|\| value === null \? \([\s\S]*?—<\/Text>/);
  assert.match(pillarRow, /\{`\$\{value\}%`\}/);
  assert.match(pillarRow, /!scoreUnavailable && value !== null && baselineBuilding/);
  assert.match(pillarRow, /!scoreUnavailable && value !== null && !baselineBuilding/);
  assert.match(bondCard, /scoreUnavailable \|\| value === null \? '—' : value/);
  assert.match(bondCard, /!scoreUnavailable && !baselineBuilding/);
});

test('score errors retain error state instead of becoming baseline state', async () => {
  const [today, card] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/DadScoreCard.tsx'),
  ]);

  assert.match(today, /baselineBuilding=\{!data\.scoreError && !data\.baselineAvailable\}/);
  assert.match(card, /\{scoreUnavailable \? \([\s\S]*Dad Health Score unavailable/);
});

test('migration adds only availability logic and preserves Change 07 trend guard', async () => {
  const migration = await source('../dadHealth/supabase/migrations/20261013100000_score_baseline_availability.sql');
  const schema = await source('../dadHealth/supabase/schema.sql');
  const types = await source('../dadHealth/src/types/database.ts');

  assert.match(migration, /create or replace function public\.is_dad_score_baseline_available/);
  assert.match(migration, /extract\(isodow from p_created_at\) = 1 then 0 else 7 end/);
  assert.match(migration, /current_week\.week_start > score_config\.effective_week_start/);
  assert.match(migration, /as baseline_available/);
  assert.match(schema, /public\.is_dad_score_baseline_available\([\s\S]*?\) as baseline_available/);
  assert.match(types, /baseline_available: boolean/);
  assert.doesNotMatch(migration, /update public\.(activity_logs|mood_logs|workout_sessions|bond_logs)/);
});
