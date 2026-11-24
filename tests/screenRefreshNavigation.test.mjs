import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('screens never refresh automatically on focus and refresh indicators are pull-driven', async () => {
  const [mind, bond, fitness, community, communityFeed, home, dashboard, legacyScore, presentDad, presentDadUI] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/BondScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/FitnessScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/CommunityScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/CommunityFeedScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/HomeScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/ProgressScreen.tsx', root), 'utf8'),
    readFile(new URL('hooks/usePresentDadMode.ts', root), 'utf8'),
    readFile(new URL('components/bond/PresentDadMode.tsx', root), 'utf8'),
  ]);

  for (const source of [mind, bond, fitness, community, communityFeed, home, dashboard]) {
    assert.match(source, /refreshing=\{refreshing\}/);
    assert.match(source, /refreshInFlight\.current/);
  }
  for (const source of [mind, bond, fitness, home, dashboard]) assert.doesNotMatch(source, /useFocusEffect/);
  // d0547e5 / 2199ecf (30 Oct) re-added narrow focus reloads on Community: trending lists only, and the
  // circle feed skips its first focus. Neither is a full-screen refresh or shows the pull indicator.
  const communityFocus = community.slice(community.indexOf('useFocusEffect(useCallback('), community.indexOf('useFocusEffect(useCallback(') + 200);
  assert.match(communityFocus, /void Promise\.all\(\[loadTrending\(\), loadTrendingCirclePosts\(\)\]\);/);
  assert.doesNotMatch(communityFocus, /setRefreshing|feed\.refresh|refresh\(\)/);
  assert.match(communityFeed, /if \(initialFocusRef\.current\) \{\s*initialFocusRef\.current = false;\s*return undefined;\s*\}/);
  assert.match(legacyScore, /navigation\.replace\('Tabs'/);
  assert.match(bond, /const refreshInFlight = useRef\(false\)/);
  assert.match(presentDadUI, /const existing = await mode\.refresh\(\)/);
  assert.match(presentDad, /const refresh = useCallback/);
  assert.match(presentDad, /finish_present_dad_session/);
});

test('tab and dashboard-menu navigation use short native-friendly transitions', async () => {
  const [tabs, dashboard, transition] = await Promise.all([
    readFile(new URL('navigation/BottomTabNavigator.tsx', root), 'utf8'),
    readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8'),
    readFile(new URL('components/ScreenTransition.tsx', root), 'utf8'),
  ]);

  assert.match(tabs, /animation: 'fade'/);
  assert.match(tabs, /sceneStyle: \{ backgroundColor: colors\.dark \}/);
  assert.match(dashboard, /<ScreenTransition key=\{activeSection\}>\{screen\}<\/ScreenTransition>/);
  assert.match(transition, /duration: 180/);
  assert.match(transition, /useNativeDriver: true/);
});

test('manual pull refresh reuses the existing screen skeletons consistently', async () => {
  const [pillar, dashboard, home, communityFeed] = await Promise.all([
    readFile(new URL('components/PillarScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/HomeScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/CommunityFeedScreen.tsx', root), 'utf8'),
  ]);

  assert.match(pillar, /const REFRESH_SKELETON_MAX_MS = 900/);
  // 3babd6e added an opt-in flag that keeps loaded content visible during a pull refresh.
  assert.match(pillar, /loading \|\| \(!preserveContentOnRefresh && refreshing && !refreshSkeletonExpired\)/);
  assert.match(pillar, /setTimeout\(\(\) => setRefreshSkeletonExpired\(true\), REFRESH_SKELETON_MAX_MS\)/);
  assert.match(pillar, /showSkeleton && skeleton \? skeleton : children/);
  assert.match(dashboard, /const showHomeSkeleton =\s*!data && loading && !dashboardError/); // 07cd0d0
  assert.match(home, /refreshing \? \([\s\S]*?<PublicHomeSkeleton \/>/);
  assert.match(communityFeed, /feed\.loading \|\| refreshing \?/);
  assert.doesNotMatch(pillar, /useFocusEffect/);
  // Today's focus refresh lives in the dashboard hook: skipped on first focus, then only when idle.
  const dashboardHook = await readFile(new URL('hooks/useDashboard.ts', root), 'utf8');
  assert.match(dashboardHook, /const shouldRefreshOnFocus = hasFocused\.current;[\s\S]*?if \(shouldRefreshOnFocus && userId && !isOffline\) void refreshDashboardIfIdle\(userId\);/);
});
