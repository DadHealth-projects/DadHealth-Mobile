import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('screens never refresh automatically on focus and refresh indicators are pull-driven', async () => {
  const [mind, bond, fitness, community, communityFeed, home, dashboard, progress, presentDad] = await Promise.all([
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/BondScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/FitnessScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/CommunityScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/CommunityFeedScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/HomeScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/ProgressScreen.tsx', root), 'utf8'),
    readFile(new URL('hooks/usePresentDadMode.ts', root), 'utf8'),
  ]);

  for (const source of [mind, bond, fitness, community, communityFeed, home, dashboard, progress]) {
    assert.doesNotMatch(source, /useFocusEffect/);
    assert.match(source, /refreshing=\{refreshing\}/);
    assert.match(source, /refreshInFlight\.current/);
  }
  assert.match(bond, /useEffect\(\(\) => \{[\s\S]*?loadConversationStarters\(\)/);
  assert.match(bond, /loadConversationStarters\(\)/);
  assert.match(bond, /presentDadMode\.refresh\(\)/);
  assert.match(presentDad, /toggle, refresh/);
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
  const [pillar, dashboard, home, progress, communityFeed] = await Promise.all([
    readFile(new URL('components/PillarScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/HomeScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/ProgressScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/CommunityFeedScreen.tsx', root), 'utf8'),
  ]);

  assert.match(pillar, /const REFRESH_SKELETON_MAX_MS = 900/);
  assert.match(pillar, /loading \|\| \(refreshing && !refreshSkeletonExpired\)/);
  assert.match(pillar, /setTimeout\(\(\) => setRefreshSkeletonExpired\(true\), REFRESH_SKELETON_MAX_MS\)/);
  assert.match(pillar, /showSkeleton && skeleton \? skeleton : children/);
  assert.match(dashboard, /\(\(!data && !dashboardError\) \|\| refreshing\)/);
  assert.match(home, /refreshing \? \([\s\S]*?<PublicHomeSkeleton \/>/);
  assert.match(progress, /refreshing \? \([\s\S]*?<ProgressSkeleton \/>/);
  assert.match(communityFeed, /feed\.loading \|\| refreshing \?/);
  assert.doesNotMatch(pillar, /useFocusEffect/);
  assert.doesNotMatch(dashboard, /useFocusEffect/);
});
