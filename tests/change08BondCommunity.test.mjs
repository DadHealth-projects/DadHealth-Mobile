import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Bond exposes only the four approved tools and preserves Change 07 logging', async () => {
  const source = await read('screens/BondScreen.tsx');
  assert.match(source, /<PresentDadMode/);
  assert.match(source, /navigate\('DadDaysSearch'\)/);
  assert.match(source, /navigate\('CookTogether'\)/);
  assert.match(source, /<ManualActivitySection pillar="bond"/);
  for (const removed of ['Dad date ideas', 'Co-parenting calendar', 'Milestone tracker', 'Conversation starters', 'familyActivityPlans']) {
    assert.equal(source.toLowerCase().includes(removed.toLowerCase()), false, `${removed} should not appear in BondScreen`);
  }
});

test('Present Dad content keeps first-use, timer, completion, and honest Focus behavior', async () => {
  const [ui, hook, migration, dispatch] = await Promise.all([
    read('components/bond/PresentDadMode.tsx'),
    read('hooks/usePresentDadMode.ts'),
    read('../dadHealth/supabase/migrations/20260928150000_change08_present_dad_and_circle_descriptions.sql'),
    read('../dadHealth/src/app/api/notifications/dispatch/route.ts'),
  ]);
  assert.match(ui, /60 minutes\. Phone down\. Just you and them\./);
  assert.match(ui, /className="gap-sm border-b border-border pb-lg active:opacity-75"/);
  assert.doesNotMatch(ui, /rounded-button border border-lime\/25 bg-card px-md py-lg/);
  assert.match(ui, /useSafeAreaInsets/);
  assert.match(ui, /edges=\{\['left', 'right', 'bottom'\]\}/);
  assert.match(ui, /contentContainerStyle=\{\{ paddingTop: Math\.max\(insets\.top, 0\) \+ 24 \}\}/);
  assert.match(ui, /sessionActive \? 'Resume session'/);
  assert.match(ui, /Your session is in progress\. Tap to return to the countdown\./);
  assert.match(ui, /accessibilityLabel=\{sessionActive \? 'Back to Bond; session continues' : 'Back to Bond'\}/);
  assert.match(ui, /<Feather name="chevron-left"/);
  assert.doesNotMatch(ui, /<Feather name="x"/);
  assert.match(ui, /intro_seen_at/);
  const openStart = ui.indexOf('const open = useCallback');
  const openEnd = ui.indexOf('\n  }, [mode.refresh', openStart);
  const openHandler = ui.slice(openStart, openEnd);
  assert.match(openHandler, /if \(preference\.data\?\.intro_seen_at\)/);
  assert.doesNotMatch(openHandler, /upsert\(/, 'showing or closing the intro must not persist it');
  const startStart = ui.indexOf('const start = useCallback');
  const startEnd = ui.indexOf('\n  }, [mode.start', startStart);
  const startHandler = ui.slice(startStart, startEnd);
  assert.match(startHandler, /const session = await mode\.start\(\);[\s\S]*?if \(session\)[\s\S]*?await persistIntroSeen\(\);[\s\S]*?setPhase\('timer'\)/);
  assert.match(ui, /45 minutes|<= 45/);
  assert.match(ui, /<= 30/);
  assert.match(ui, /<= 15/);
  assert.match(ui, /<= 5/);
  assert.match(ui, /iPhone Focus for you/);
  assert.match(ui, /Session complete/);
  assert.match(ui, /View Bond score/);
  assert.match(ui, /onPress=\{\(\) => void viewBondScore\(\)\}/);
  assert.match(ui, /const viewBondScore = useCallback\(async \(\) => \{\s*await dismiss\(\);\s*onViewBondScore\(\);/);
  assert.match(ui, /Text className="font-heading-bold text-lime text-\[11px\] tracking-label uppercase">Done/);
  assert.match(hook, /finish_present_dad_session/);
  assert.match(hook, /acknowledge_present_dad_completion/);
  assert.match(hook, /We could not start Present Dad Mode/);
  assert.match(hook, /We could not save this session yet/);
  assert.match(migration, /completed_duration_seconds integer/);
  assert.match(migration, /p_duration_seconds >= 300/);
  assert.match(migration, /revoke all on public\.present_dad_sessions from public, anon, authenticated/);
  assert.match(dispatch, /\.eq\("status", "active"\)\s*\.lte\("ends_at", nowIso\)/);
  assert.match(dispatch, /update\(\{ status: "completed", completed_at: nowIso \}\)/);
  assert.match(dispatch, /\.gte\("completed_duration_seconds", 3600\)/);
  const bond = await read('screens/BondScreen.tsx');
  assert.match(bond, /navigation\.navigate\('Tabs', \{\s*screen: 'Home',\s*params: \{ openScoreDetail: true \}/);
  assert.match(bond, /onViewBondScore=\{onViewBondScore\}/);
});

test('Community uses Admin-managed descriptions and the approved subtitle', async () => {
  const [mobile, card, mockup, migrations] = await Promise.all([
    read('screens/CommunityScreen.tsx'),
    read('components/mockup/CircleCard.tsx'),
    read('mockups/DadHealth_AppStore_Screenshots (1).html'),
    readdir(new URL('../../dadHealth/supabase/migrations/', import.meta.url)),
  ]);
  const migration = await read(`../dadHealth/supabase/migrations/${migrations.find((name) => name.includes('change08_present_dad_and_circle_descriptions'))}`);
  assert.match(mobile, /Your Dad Circles — find dads going through the same chapter as you/);
  assert.match(mobile, /select\('id,icon,name,description,members_count'\)/);
  assert.match(mobile, /description=\{circle\.description\}/);
  assert.match(mobile, /Array\.from\(\{ length: Math\.ceil\(communityCircles\.length \/ 2\) \}/);
  assert.match(mobile, /flex-row items-stretch gap-sm/);
  assert.match(mobile, /communityCircles\.slice\(rowIndex \* 2, rowIndex \* 2 \+ 2\)/);
  assert.doesNotMatch(mobile, /communityCircles\.filter\(\(_, index\) => index % 2/);
  assert.doesNotMatch(mobile, /View key=\{circle\.id\} className="w-\[48%\]"/);
  assert.match(card, /\{description \? <Text/);
  assert.match(card, /flex-1 flex-col rounded-card p-md/);
  assert.match(card, /grow font-body text-muted-text/);
  assert.match(card, /mt-auto flex-row items-center justify-between pt-md/);
  assert.match(migration, /add column if not exists description text/);
  assert.match(mockup, /Every Kind of Dad/);
  const sourceFiles = [
    'screens/CommunityScreen.tsx',
    'mockups/DadHealth_AppStore_Screenshots (1).html',
  ];
  for (const file of sourceFiles) assert.doesNotMatch(await read(file), /Teen Dad Club/i);
});

test('Present Dad pgTAP has one plan matching its assertion count', async () => {
  const sql = await read('../dadHealth/supabase/tests/change08_present_dad_test.sql');
  const plans = [...sql.matchAll(/^select plan\((\d+)\);$/gm)];
  const assertions = [...sql.matchAll(/^select\s+(?:lives_ok|is|ok|throws_ok)\(/gm)];
  assert.equal(plans.length, 1);
  assert.equal(Number(plans[0][1]), assertions.length);
  assert.equal(sql.includes('present_dad_session_counts_toward_score(299)'), false);
});

test('Dad Days and Cook Together existing integrations remain wired', async () => {
  const [bond, dadDays, cookHook, sql] = await Promise.all([
    read('screens/BondScreen.tsx'),
    read('screens/subscreens/DadDaysSearchScreen.tsx'),
    read('hooks/useCookTogetherRecipes.ts'),
    read('../dadHealth/supabase/schema.sql'),
  ]);
  assert.match(bond, /navigate\('DadDaysSearch'\)/);
  assert.match(dadDays, /FREE_LIMIT/);
  assert.match(dadDays, /childAge/);
  assert.match(dadDays, /budget/);
  assert.match(dadDays, /radius/);
  assert.match(cookHook, /supabase\.rpc\('complete_cook_together_recipe'/);
  assert.match(sql, /insert into bond_logs[\s\S]*?'cook_together_recipe'/);
  assert.match(sql, /from public\.bond_logs bl where bl\.user_id = p_user_id/);
  assert.doesNotMatch(sql, /earned_badges[\s\S]{0,250}cook_together_recipe/);
});
