import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, Date, Number, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; },
  });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const week = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];

test('calm reset message appears only for a server-recorded reset in the week on screen, without guilt language', () => {
  const { calmResetMessage } = load('lib/streakPresentation.ts');
  const message = calmResetMessage('2026-11-24', week);
  assert.equal(message, "Your streak restarted on Tuesday 24 November. That's okay. Every check-in counts, starting with today's.");
  assert.doesNotMatch(message, /lost|broke|failed|missed|shame|again\?/i);
  assert.equal(calmResetMessage('2026-11-16', week), null, 'older resets are not repeated');
  assert.equal(calmResetMessage(null, week), null);
  assert.equal(calmResetMessage(undefined, week), null, 'older servers omit the field');
  assert.equal(calmResetMessage('24/11/2026', week), null);
});

test('streak status accepts the server reset day and rejects malformed values', () => {
  const { parseStreakStatus } = load('hooks/useStreakStatus.ts', { './useWeeklyReport': { useItem02Resource: () => null } });
  const streak = { state: 'current', count: 1, lastKnownCount: 1, reconciledThrough: '2026-11-24', allowance: 0,
    protectedDates: [], calendarDays: week, currentDate: '2026-11-25' };
  assert.equal(parseStreakStatus({ streak: { ...streak, resetOn: '2026-11-24' } }).resetOn, '2026-11-24');
  assert.equal(parseStreakStatus({ streak }).resetOn, null);
  assert.throws(() => parseStreakStatus({ streak: { ...streak, resetOn: 'Tuesday' } }), /Streak unavailable/);
  assert.equal(parseStreakStatus({ streak: { ...streak, state: 'pending', count: null, allowance: null, resetOn: '2026-11-24' } }).resetOn, null,
    'only a current streak can carry a reset day');
});

test('the streak card shows the calm line only for a current, error-free status', () => {
  const card = read('components/dashboard/StreakCard.tsx');
  assert.match(card, /const resetMessage = status\?\.state === 'current' && !error \? calmResetMessage\(status\.resetOn, status\.calendarDays\) : null;/);
  assert.match(card, /\{resetMessage \? <Text[^>]*>\{resetMessage\}<\/Text> : null\}/);
});

test('badge celebration: first run sets a baseline, later only newly earned badges are celebrated once', () => {
  const { newlyEarnedBadges, celebrationText } = load('lib/badgeCelebration.ts');
  const streak = { icon: '🔥', name: '7-day streak' }, first = { icon: '✅', name: 'First check-in' };
  assert.deepEqual(plain(newlyEarnedBadges([first, streak], null)), [], 'historical badges never pop up');
  assert.deepEqual(plain(newlyEarnedBadges([first, streak], ['First check-in'])), [streak]);
  assert.deepEqual(plain(newlyEarnedBadges([first, streak], ['First check-in', '7-day streak'])), []);
  assert.deepEqual(plain(newlyEarnedBadges([streak, streak], [])), [streak], 'duplicates collapse');
  assert.equal(celebrationText([streak]), 'Badge earned: 7-day streak. Nice work.');
  assert.equal(celebrationText([first, streak]), '2 new badges earned: First check-in, 7-day streak. Nice work.');
  assert.equal(celebrationText([]), null);
});

test('celebration never treats a failed badge read as "no badges" and is private per account', () => {
  const screen = read('screens/DashboardScreen.tsx'), hook = read('hooks/useDashboard.ts');
  const component = read('components/dashboard/BadgeCelebration.tsx'), storage = read('lib/offlineStorage.ts');
  assert.match(hook, /badgesReadFailed: Boolean\(badgesResult\.error\),/);
  assert.match(screen, /\{!isOffline \? <BadgeCelebration userId=\{user\.id\} badges=\{data\.badgesReadFailed \? null : data\.badges\} \/> : null\}/);
  assert.match(component, /if \(!badges \|\| names === null\) return;/);
  assert.match(component, /if \(!active \|\| owner\.current !== userId \|\| seen === undefined\) return;/);
  assert.match(component, /useEffect\(\(\) => \{ setFresh\(\[\]\); \}, \[userId\]\);/);
  assert.match(storage, /privateKey\(userId, 'queue'\),\s*privateKey\(userId, 'badges_seen'\),\s*\]\);/, 'cleared with other private data');
  // Awarding stays server-only: the app never writes earned badges.
  for (const file of ['components/dashboard/BadgeCelebration.tsx', 'lib/badgeCelebration.ts', 'hooks/useProgressBadges.ts']) {
    assert.doesNotMatch(read(file), /earned_badges'\)\.(insert|upsert|update)/);
  }
});
