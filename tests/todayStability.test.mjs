import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mergeDashboardRefreshState } from '../lib/dashboardRefreshState.js';
import { canAccessFeature } from '../lib/proEntitlementAccess.js';
const root = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');

const snapshot = (overrides = {}) => ({
  isPro: null,
  trialActive: null,
  freezeUsedThisWeek: null,
  freezesRemaining: null,
  checkedInToday: null,
  moodLogs: [],
  streak: null,
  totalScore: null,
  mindScore: null,
  bodyScore: null,
  bondScore: null,
  mindWeekChange: null,
  bodyWeekChange: null,
  bondWeekChange: null,
  baselineAvailable: false,
  scoreError: null,
  weakestPillar: null,
  recommendedAction: null,
  ...overrides,
});

test('same-account refresh failures retain confirmed Pro, Free, check-in, streak and score state', () => {
  const previous = snapshot({
    isPro: true,
    trialActive: true,
    checkedInToday: true,
    moodLogs: [{ date: '2026-10-18', mood_value: 2 }],
    streak: 8,
    totalScore: 61,
    mindScore: 50,
  });
  const next = snapshot({ totalScore: null, checkedInToday: null });
  const merged = mergeDashboardRefreshState('user-1', 'user-1', previous, next, {
    entitlement: true,
    mood: true,
    streak: true,
    score: true,
  });
  assert.equal(merged.isPro, true);
  assert.equal(merged.trialActive, true);
  assert.equal(merged.checkedInToday, true);
  assert.equal(merged.moodLogs.length, 1);
  assert.equal(merged.streak, 8);
  assert.equal(merged.totalScore, 61);
  assert.equal(canAccessFeature('weekly_report', merged.isPro, merged.trialActive), true);

  const free = mergeDashboardRefreshState('user-1', 'user-1', snapshot({ isPro: false }), next, { entitlement: true });
  assert.equal(free.isPro, false);
  assert.equal(canAccessFeature('weekly_report', free.isPro, free.trialActive), false);
});

test('a verified downgrade applies immediately and a manual grant remains server-confirmed Pro', () => {
  const next = snapshot({ isPro: false, trialActive: false });
  const downgraded = mergeDashboardRefreshState('user-1', 'user-1', snapshot({ isPro: true }), next, {});
  const manualGrant = mergeDashboardRefreshState('user-1', 'user-1', snapshot(), snapshot({ isPro: true }), {});
  assert.equal(downgraded.isPro, false);
  assert.equal(canAccessFeature('ai_workout', downgraded.isPro, downgraded.trialActive), false);
  assert.equal(manualGrant.isPro, true);
  assert.equal(canAccessFeature('ai_workout', manualGrant.isPro, manualGrant.trialActive), true);
});

test('account switching never carries the previous account entitlement or completion state', () => {
  const previous = snapshot({ isPro: true, checkedInToday: true, streak: 12 });
  const next = snapshot({ isPro: null, checkedInToday: null, streak: null });
  assert.deepEqual(mergeDashboardRefreshState('user-2', 'user-1', previous, next, {
    entitlement: true, mood: true, streak: true,
  }), next);
});

test('Today retains loaded content during refresh and shows neutral failed-read states', async () => {
  const [screen, hook, streak, report] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('hooks/useDashboard.ts'),
    source('components/dashboard/StreakCard.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
  ]);
  assert.match(screen, /const showHomeSkeleton =\s*!data && loading && !dashboardError;/);
  assert.match(screen, /checkedInToday === null/);
  assert.match(hook, /checkedInToday: moodsResult\.error \|\| !accountDate \? null/);
  assert.match(streak, /status\?\.state === 'current' \? status.count : null/);
  assert.match(report, /reportDates\(report.weekStart, report.weekEndExclusive\)/);
});

test('resume refresh is active-screen scoped and coalesces with an in-flight dashboard read', async () => {
  const hook = await source('hooks/useDashboard.ts');
  // Focus/resume now skips a reload inside a short freshness window (tests/dashboardFreshness.test.mjs);
  // outside it, the refresh still joins any in-flight read via loadDashboard.
  assert.match(hook, /export function refreshDashboardIfIdle\(userId: string\): Promise<void> \{[\s\S]*?return inFlightByUser\.get\(userId\) \?\? Promise\.resolve\(\);\s*return loadDashboard\(userId\);/);
  assert.match(hook, /useFocusEffect\(useCallback\(\(\) => \{[\s\S]*?AppState\.addEventListener/);
  assert.match(hook, /refreshDashboardIfIdle\(userId\)/);
  assert.doesNotMatch(hook, /useEffect\(\(\) => \{\s*if \(!userId\) return;\s*let previousState = AppState\.currentState/);
});

test('Free weekly-report entry opens saved reports without substituting Today scores', async () => {
  const vm = await import('node:vm');
  const ts = (await import('typescript')).default;
  const exports = {};
  const react = { memo: fn => fn, createElement: (type,props,...children) => ({type,props:{...props,children}}) };
  const mocks = {
    react: {...react,default:react}, '@expo/vector-icons': {Feather:'Feather'},
    'react-native': {Pressable:'Pressable',Text:'Text',View:'View'},
    '../../theme': {colors:{lime:'lime'}},
    '../../lib/weeklyReport': {reportDates:(start,end)=>`${start}/${end}`},
  };
  vm.runInNewContext(ts.transpileModule(await source('components/dashboard/WeeklyReportCard.tsx'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React},
  }).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});
  let opened=0;
  const report={access:'free',weekStart:'2026-11-09',weekEndExclusive:'2026-11-16'};
  const card=exports.default({report,currentScore:123456,onOpen:()=>opened++});
  const text=JSON.stringify(card);
  assert.match(text,/2026-11-09\/2026-11-16/);
  assert.doesNotMatch(text,/123456|Current Dad Health Score/);
  card.props.children[0].props.onPress();assert.equal(opened,1);
  const empty=exports.default({report:null,onOpen:()=>opened++});
  assert.match(JSON.stringify(empty),/View your weekly summary/);
  empty.props.children[0].props.onPress();assert.equal(opened,2);
  const screen=await source('screens/DashboardScreen.tsx');
  assert.match(screen,/report=\{latestReport.report\}/);
});
