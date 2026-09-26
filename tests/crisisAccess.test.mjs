import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('one root crisis control covers signed-in, signed-out and auth routes without gating', async () => {
  const [rootNavigator, mind, crisisButton] = await Promise.all([
    readFile(new URL('contexts/RootNavigator.tsx', root), 'utf8'),
    readFile(new URL('screens/MindScreen.tsx', root), 'utf8'),
    readFile(new URL('components/GlobalCrisisHelpButton.tsx', root), 'utf8'),
  ]);

  assert.equal((rootNavigator.match(/<GlobalCrisisHelpButton\b/g) ?? []).length, 1);
  assert.match(rootNavigator, /waitingForSession \? <Splash \/> : !session \?/);
  assert.match(rootNavigator, /!waitingForSession \? \([\s\S]*?<GlobalCrisisHelpButton[\s\S]*?screenContentReady=\{screenContentReady\}[\s\S]*?\) : null/);
  assert.doesNotMatch(mind, /CrisisSupportRow/);
  assert.match(crisisButton, /BUTTON_SIZE = 48/);
  assert.match(crisisButton, /PROMPT_INTERVAL_MS = 10 \* 60 \* 1000/);
  assert.match(crisisButton, /setInterval\(presentPrompt, PROMPT_INTERVAL_MS\)/);
  assert.match(crisisButton, /Animated\.spring\(buttonScale, \{ toValue: 1\.07/);
  assert.match(crisisButton, /transform: \[\{ scale: buttonScale \}\]/);
  assert.match(crisisButton, /PROMPT_VISIBLE_MS = 30 \* 1000/);
  assert.match(crisisButton, /w-\[230px\]/);
  assert.match(crisisButton, /w-full text-left/);
  assert.match(crisisButton, /TAB_NAV_CLEARANCE = 110/);
  assert.match(crisisButton, /AUTH_SAFE_CLEARANCE = 88/);
  assert.match(crisisButton, /HIDDEN_ROUTES = new Set\(\['Welcome', 'Login', 'OnboardingGoals', 'OnboardingCustody'\]\)/);
  assert.match(crisisButton, /if \(keyboardOpen \|\| !appActive \|\| !routeAllowed \|\| !screenContentReady\) return null/);
  assert.match(crisisButton, /!routeAllowedRef\.current/);
  assert.match(crisisButton, /accessibilityRole="button"/);
  assert.match(crisisButton, /accessibilityLabel=\{FOOTER\.crisis\.label\}/);
  assert.match(crisisButton, /accessibilityHint=/);
  assert.doesNotMatch(crisisButton, /useAuth|isPro|ProSubscription|navigate\(['"]Login/);
});

test('global crisis control respects keyboard, safe-area, tab-bar and app-state clearances', async () => {
  const crisisButton = await readFile(new URL('components/GlobalCrisisHelpButton.tsx', root), 'utf8');

  assert.match(crisisButton, /Keyboard\.addListener\('keyboardDidShow'/);
  assert.match(crisisButton, /if \(keyboardOpen \|\| !appActive \|\| !routeAllowed \|\| !screenContentReady\) return null/);
  assert.match(crisisButton, /AppState\.addEventListener\('change'/);
  assert.match(crisisButton, /insets\.bottom \+ \(hasBottomNavigation \? TAB_NAV_CLEARANCE : AUTH_SAFE_CLEARANCE\)/);
  assert.match(crisisButton, /navigationRef\.addListener\('state'/);
  assert.match(crisisButton, /navigationRef\.addListener\('ready'/);
  assert.match(crisisButton, /setTimeout\(\(\) => \{/);
  assert.match(crisisButton, /keyboardOpenRef\.current[\s\S]*?appActiveRef\.current[\s\S]*?routeAllowedRef\.current[\s\S]*?screenContentReadyRef\.current/);
  assert.match(crisisButton, /Need to talk to someone\?/);
});

test('global crisis control waits for real screen content instead of appearing over skeletons', async () => {
  const [rootNavigator, pillars, today, activeWorkout] = await Promise.all([
    readFile(new URL('contexts/RootNavigator.tsx', root), 'utf8'),
    readFile(new URL('components/PillarScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/DashboardScreen.tsx', root), 'utf8'),
    readFile(new URL('screens/subscreens/ActiveWorkoutScreen.tsx', root), 'utf8'),
  ]);

  assert.match(rootNavigator, /screenContentReady=\{screenContentReady\}/);
  assert.match(rootNavigator, /ScreenContentReadyContext\.Provider/);
  assert.match(pillars, /if \(showSkeleton\) reportScreenContentReady\(false\)/);
  assert.match(pillars, /showSkeleton \? undefined : \(\) => reportScreenContentReady\(true\)/);
  assert.match(today, /const showHomeSkeleton = \(!data && !dashboardError\) \|\| refreshing/);
  assert.match(today, /if \(showHomeSkeleton\) reportScreenContentReady\(false\)/);
  assert.match(today, /onLayout=\{\(\) => reportScreenContentReady\(true\)\}/);
  assert.match(activeWorkout, /if \(library\.loading\) reportScreenContentReady\(false\)/);
  assert.match(activeWorkout, /library\.loading \? undefined : \(\) => reportScreenContentReady\(true\)/);
});

test('crisis call and fallback derive the existing contact from FOOTER.crisis', async () => {
  const [config, helper] = await Promise.all([
    readFile(new URL('lib/homeContent.ts', root), 'utf8'),
    readFile(new URL('lib/crisisSupport.ts', root), 'utf8'),
  ]);

  assert.match(config, /crisis: \{ label: 'CRISIS SUPPORT .* tel: '116123' \}/);
  assert.match(helper, /import \{ FOOTER \} from '\.\/homeContent'/);
  assert.match(helper, /Linking\.openURL\(`tel:\$\{FOOTER\.crisis\.tel\}`\)/);
  assert.match(helper, /crisisSupportPhoneDisplay\(\)/);
  assert.match(helper, /Unable to start the call/);
});
