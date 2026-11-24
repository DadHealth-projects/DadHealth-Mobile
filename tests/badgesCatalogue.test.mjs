import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Brief 07: badges are shown on a simple screen with locked ones greyed out, free for everyone.
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exports = {};
const mocks = {
  react: { useCallback: (fn) => fn, useEffect: () => {}, useState: (v) => [v, () => {}] },
  '../contexts/NetworkContext': { useNetworkStatus: () => ({ isOffline: false }) },
  '../lib/offlineStorage': { readDashboardCache: async () => null },
  '../lib/supabase': { supabase: {} },
};
vm.runInNewContext(ts.transpileModule(source('hooks/useProgressBadges.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: (name) => { assert.ok(name in mocks, `Unexpected import ${name}`); return mocks[name]; } });
const { badgeCatalogue } = exports;

test('every catalogue badge is listed; only the account’s earned ids are unlocked', () => {
  const rows = [
    { id: 'b1', icon: '✅', name: 'First check-in' },
    { id: 'b2', icon: '🔥', name: '7-day streak' },
    { id: 'b3', icon: '🧒', name: 'First Mini Partners session' },
  ];
  const result = badgeCatalogue(rows, new Set(['b2', 'not-in-catalogue']));
  assert.deepEqual(result.map((badge) => [badge.name, badge.earned]), [
    ['First check-in', false], ['7-day streak', true], ['First Mini Partners session', false],
  ]);
});

test('no earned rows means every badge is locked, never invented as earned', () => {
  const result = badgeCatalogue([{ id: 'b1', icon: '✅', name: 'First check-in' }], new Set());
  assert.equal(result.length, 1);
  assert.equal(result[0].earned, false);
});

test('malformed catalogue rows are skipped rather than rendered', () => {
  const result = badgeCatalogue([{ id: 'b1', icon: '✅' }, { icon: 'x', name: 'No id' }, { id: 'b2', icon: '⭐', name: 'Valid' }], new Set());
  assert.deepEqual(result.map((badge) => badge.id), ['b2']);
});

test('hook reads catalogue ids and keeps the offline fast path', () => {
  const hook = source('hooks/useProgressBadges.ts');
  assert.match(hook, /from\('badges'\)\.select\('id,icon,name'\)/);
  assert.match(hook, /from\('earned_badges'\)\.select\('badge_id,badges\(icon,name\)'\)\.eq\('user_id', userId\)/);
  assert.ok(hook.includes('isOffline'));
});

test('score details list locked badges greyed, labelled for screen readers, never behind Pro or a lock icon', () => {
  const sheet = source('components/dashboard/ScoreDetailSheet.tsx');
  const start = sheet.indexOf('<SectionHeader title="Badges"');
  const end = sheet.indexOf('Share report', start);
  assert.ok(start > 0 && end > start);
  const section = sheet.slice(start, end);
  assert.match(section, /badgeData\.catalogue\.map\(\(badge\) =>/);
  assert.match(section, /badge\.earned \? 'border-lime\/20' : 'border-border opacity-40'/);
  assert.match(section, /\$\{badge\.earned \? 'earned' : 'locked'\}/);
  assert.doesNotMatch(section, /isPro|entitlement|LockedPreview|name="lock"/);
});
