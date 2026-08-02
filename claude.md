# Track A: Shell + Navigation ✅  (+ NativeWind styling upgrade ✅)

## Completed
- Bottom tab navigator (5 screens: Home, Fitness, Mind, Bond, Community)
- Theme extracted from web (lime, dark, Barlow fonts) → `theme.ts`
- Polished screens: rounded shadowed cards, lime CTA buttons, staggered entrance
- NativeWind (Tailwind for RN) + Reanimated + real Barlow fonts via expo-font
- Works on iPhone 13 via Expo Go (Android-safe: elevation + safe-area insets)

## Architecture
- `App.js` — imports `global.css`, loads Barlow fonts (`useFonts`), then
  `SafeAreaProvider` → `NavigationContainer` → `RootStack` → `BottomTabNavigator`
- `navigation/BottomTabNavigator.tsx` — 5 tabs, Feather icons in a lime pill when
  active, rounded/shadowed dark bar, safe-area-aware height, white Barlow labels
- `screens/*.tsx` — declarative: pass `label/title/intro/cards/ctaLabel` to `ScreenScaffold`
- `components/ScreenScaffold.tsx` — hero (section-label + Barlow Condensed h1) + Reanimated cards
- `components/Card.tsx`, `components/LimeButton.tsx` — reusable rounded/shadowed surfaces
- `theme.ts` — `colors`, `fonts`, `spacing`, `typography`, `shadows` (from `dadHealth/src/index.css`)

## Styling stack
- `tailwind.config.js` — NativeWind preset; web colors, Barlow `fontFamily`,
  8px `spacing` scale, `rounded-card` (16px) / `rounded-button` (12px)
- `babel.config.js` — `babel-preset-expo` w/ `jsxImportSource: nativewind` + `nativewind/babel`
  (Reanimated 4 worklets plugin is auto-added by babel-preset-expo — do NOT re-add)
- `metro.config.js` — `withNativeWind(config, { input: './global.css' })`
- Shadows live in `theme.ts` (JS) not classes — Android needs `elevation`, iOS `shadow*`

## Theme values (from web index.css / tailwind.config.ts)
- Lime `#C8F55A` (--primary/--lime, hsl 78 89% 65%)
- Dark `#0A0A0A` (--background, 0 0% 4%)
- Card `#111111` (--card, 0 0% 6%)
- Muted/Border `#1F1F1F` (0 0% 12%), muted text `#C7C7C7` (0 0% 78%)
- Fonts: Barlow Condensed (headings), Barlow (body)
- Spacing 8px increments: xs 4, sm 8, md 16, lg 24, xl 32

# Track B: Auth + Biometric ✅

## Completed
- Supabase auth (email/password sign up + sign in) against the same project as web
  (`vpshxswclkczbjtiyirc`, dadhealth-prod)
- Biometric login (Face ID / Touch ID via `expo-local-authentication`)
- Session persistence in the hardware keychain (`expo-secure-store`) — auto-login
- Auth-gated tabs; Profile tab (6th) with email + Log Out + web dashboard link

## Auth architecture
- `lib/supabase.ts` — RN Supabase client. `react-native-url-polyfill/auto`,
  `storage: SecureStoreAdapter`, `persistSession`, `autoRefreshToken`,
  `detectSessionInUrl: false`; AppState listener drives token auto-refresh.
- `lib/secureStore.ts` — chunked SecureStore adapter (splits values <2 KB across
  `${key}.N` keys + `${key}.__count`), because a Supabase session exceeds
  SecureStore's ~2048-byte per-value limit.
- `contexts/AuthContext.tsx` — `useAuth()` = `{ user, session, loading, signUp,
  signIn, signOut }`. ONE `onAuthStateChange` on mount (fires `INITIAL_SESSION`,
  hydrates persisted session); NO `getSession()` (avoids duplicate round-trips,
  same rule as web). `signIn` saves biometric creds on success.
- `lib/biometric.ts` — `isBiometricAvailable`, `getBiometricLabel`,
  `save/has/clearBiometricCredentials`, `biometricLogin()` (prompt → read stored
  creds → `signInWithPassword`). Takes NO args (password isn't in hand at unlock
  time; it's read from the previous manual login). Stale creds auto-cleared.
- `contexts/RootNavigator.tsx` — dark splash while `loading`, then `session ?
  <BottomTabNavigator/> : <LoginScreen/>` (React Navigation auth-flow pattern).
- `screens/LoginScreen.tsx`, `screens/ProfileScreen.tsx` — NativeWind UI.
- `.env` (git-ignored) — `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY/WEB_URL`. NO hardcoded
  key fallback in source: `lib/supabase.ts` throws on startup if the Supabase vars
  are missing. See `README.md` / `.env.example` for setup. Anon key is public.
- `app.json` — added `expo-local-authentication` plugin (Face ID permission string).

## Auth gotchas
- Face ID config-plugin permission only applies in a dev/prebuild; in Expo Go the
  biometric prompt still works (uses Expo Go's own Info.plist).
- Biometric creds are kept on Log Out (so Face ID can log back in); cleared only
  when the stored password fails.

# Milestone 1: Foundation, Auth & Navigation ✅

## Scope delivered
- App opens like the web: valid Supabase session → straight into the app; no
  session → the initial experience (LoginScreen); logout returns there.
- Login is **email/password only** (matches "no email confirmation yet"; OAuth and
  forgot-password exist on web but are intentionally out of this milestone).
- After login the user lands on the **Home** dashboard — never Profile.
- Biometric (Face ID / Touch ID) login integrated into the auth flow (Track B).
- Navigation restyled to the client's HTML mockups.

## Navigation architecture (M1)
- `contexts/RootNavigator.tsx` — auth gate only: `loading → Splash`,
  `session ? <AppNavigator/> : <LoginScreen/>`. The onboarding branch was removed
  from the gate (see "Onboarding" below).
- `navigation/AppNavigator.tsx` — native-stack: `Tabs` (the bottom tabs) +
  `Profile` presented as a **modal**. Profile/Log Out is NOT a bottom tab —
  matches the web (account lives in an avatar menu) and the mockups (no Profile tab).
- `navigation/BottomTabNavigator.tsx` — custom `MockupTabBar` matching the mockup
  `.app-nav`: flat dark (#0A0A0A) bar, hairline top border, 9px uppercase labels
  (muted → lime when active), and a **raised lime rounded-square center button**.
  Tabs in bar order: **Fit · Mind · Home(center) · Bond · Squad** (Fitness→"Fit",
  Community→"Squad"). `initialRouteName="Home"` so login lands on the center/Home.
  Icons are Feather (the mockup uses emoji; Feather is kept for a crisp,
  cross-platform, on-brand look consistent with the web's lucide icons).
- `components/ScreenScaffold.tsx` — top-right account avatar (user initial) on every
  pillar screen → opens the Profile modal (`navigation.navigate('Profile')`).
- `screens/ProfileScreen.tsx` — now a modal; added an X close button
  (`navigation.goBack()`). Still shows email + Log Out + web dashboard link.

# Milestone 2: Full Screen Conversion + Onboarding ✅

## Scope delivered

### Welcome Screen (`screens/WelcomeScreen.tsx`)
- First screen shown to new users (when `onboardingComplete === false`).
- Dad Health logo + tagline: "A healthier life, with your kids at the heart of it."
- Progress bar (1/3 dots) + "Continue" button → navigates to OnboardingGoals.

### Onboarding Goals Screen (`screens/OnboardingGoalsScreen.tsx`)
- Second screen in the onboarding flow.
- "What brings you here?" — 6 goal cards with icons (e.g. "I want to be more present",
  "I want to get stronger", etc.) defined in `lib/onboarding.ts` as `GOALS`.
- Multi-select toggle (chips style). Progress bar (2/3 dots).
- Saves selected goals to `user_profile.goals` via Supabase upsert on "Continue".
- Uses `navigation.replace('OnboardingCustody', { goals })` — no back button,
  can't re-submit goals twice.
- Fixed footer layout (always-visible Continue button) — same pattern as custody screen.

### Onboarding Custody Screen (`screens/OnboardingCustodyScreen.tsx`)
- Third and final onboarding screen.
- "How often do you see your kids?" — 5 custody options with icons + subtext.
- Progress bar (3/3 dots). No back button.
- **Single combined save**: writes goals (passed from previous step via route params) +
  `custody_pattern` + legacy `custody_arrangement` (mapped via `LEGACY_CUSTODY_MAP`) +
  `onboarding_complete: true` in ONE Supabase upsert.
- After save, calls `refreshOnboarding()` — if complete, instantly resets the
  navigation stack to `Tabs` via `navigation.reset()`.
- Shows "Your Bond score is protected" info card for non-daily custody selections.
- Fixed footer layout with `LimeButton` (always visible, no hand-rolled Pressable).

### Root Navigator Gating (`contexts/RootNavigator.tsx`)
- When `session` is true but `onboardingComplete` is false → renders `AppNavigator`
  with `initialRouteName="Welcome"` and `key="onboarding"` (forces remount).
- When `session` is true and `onboardingComplete` is true → renders `AppNavigator`
  with `initialRouteName="Tabs"` and `key="tabs"`.
- When `session` is null → renders `AppNavigator` with `initialRouteName="Tabs"` and
  `key="tabs"` (stays on the app with "?" avatar — no redirect to LoginScreen).
- Loading state shows dark `Splash` component.

### Onboarding Data Model (`lib/onboarding.ts`)
- `CUSTODY_OPTIONS`: 5 patterns with icons, labels, and subtext: Daily, Most Days,
  Alternate Weeks, Occasionally, Flexible.
- `LEGACY_CUSTODY_MAP`: maps each `CustodyPattern` to the old `custody_arrangement`
  string for web compatibility (e.g. `daily` → `Every day`).
- `GOALS`: 6 goal cards with icons and subtext for the goals screen.
- `isOnboardingComplete()`: checks `goals` (non-empty array), `custody_pattern`
  (non-null), and `onboarding_complete === true`.
- `onboardingSaveErrorMessage()`: user-friendly error messages for common Supabase
  error codes (42703 = missing column, 23505 = duplicate, etc.).

### Logout Behavior
- Logout from the Account Sheet → session clears → `RootNavigator` renders the
  tabs directly (not `UnauthedFlow`).
- The Account Sheet automatically switches to the logged-out state (shows "Sign In"
  instead of "My Profile", "Log Out" row is hidden).
- Account button in `ScreenScaffold` shows "?" when logged out.
- Tapping "?" → Account Sheet → "Sign In" → navigates to the Login screen.
- After sign-in the session flips and the tree re-renders with the full experience.

### AppNavigator (`navigation/AppNavigator.tsx`)
- Updated `AppStackParamList`: `OnboardingCustody: { goals: string[] } | undefined`.
- `initialRouteName` prop (defaults to `'Tabs'`).
- Now accepts and uses `initialRouteName` prop from `RootNavigator`.
- Onboarding screens are registered before the Tabs screen in the stack so the
  initialRouteName can be 'Welcome'.

## Onboarding flow
1. **Fresh install / onboarding reset** → RootNavigator sees `onboardingComplete: false`
   → renders AppNavigator with `initialRouteName="Welcome"`.
2. **Welcome** → tap "Continue" → navigate to OnboardingGoals.
3. **OnboardingGoals** → select goals → tap "Continue" → upsert goals to Supabase →
   `navigation.replace('OnboardingCustody', { goals })`.
4. **OnboardingCustody** → select custody → tap "Continue" → single upsert (goals +
   custody_pattern + custody_arrangement + onboarding_complete: true) →
   `refreshOnboarding()` → `navigation.reset({ routes: [{ name: 'Tabs' }] })`.
5. **Tabs** → full app experience. Logout stays on Tabs with "?" avatar.

## Remaining screens (placeholder — no mockups yet)
The 5 pillar screens (Home, Fitness, Mind, Bond, Community) are still running the
old `ScreenScaffold` with placeholder cards. The mockups in `mockups/DadHealth_AppStore_Screenshots (1).html`
show the intended designs for each pillar but have NOT been implemented yet:

- **Home** — should show Dad Score ring, score breakdown bars, daily check-in (mood + sleep),
  daily goals/streak. Currently shows static placeholder cards.
- **Fitness** — should show workout timer, exercise list, progress stats, meal planner,
  workout generator, TDEE calculator. Currently shows static placeholder cards.
- **Mind** — should show breathing circle (4-4-4 with audio), journal with prompts,
  mood trend chart, therapist finder, crisis support. Currently shows static placeholder cards.
- **Bond** — should show Bond score, custody-adaptive scoring, Present Dad Mode toggle,
  milestone tracker with photo uploads, dad date ideas with filters, conversation starters,
  co-parenting calendar, Cook Together recipes, Dad Days search. Currently shows static
  placeholder cards.
- **Community** — should show post feed (compose, like, save, delete), circles grid,
  live sessions, trending tags, anonymous posting. Currently shows static placeholder cards.

## Database schema notes
- `user_profile` table: requires `custody_pattern` column (text). If missing, run:
  ```sql
  alter table user_profile add column if not exists custody_pattern text;
  ```
- `onboarding_complete` column (boolean) in `user_profile`.
- `goals` column (jsonb) in `user_profile`.
- The `custody_arrangement` column is kept for web compatibility — both are written
  on the custody step.

## Key files for Milestone 2
- `screens/WelcomeScreen.tsx` — onboarding entry point
- `screens/OnboardingGoalsScreen.tsx` — goal selection (step 2)
- `screens/OnboardingCustodyScreen.tsx` — custody selection (step 3, final save)
- `lib/onboarding.ts` — data model, options, completion check, save error messages
- `contexts/RootNavigator.tsx` — auth + onboarding gating
- `navigation/AppNavigator.tsx` — stack with onboarding screens + Tabs
- `contexts/AuthContext.tsx` — `onboardingComplete`, `refreshOnboarding()`, `manualSignOut`

## Next milestone
- **Full Screen Conversion** — replace the placeholder `ScreenScaffold` with actual
  content matching the mockups for all 5 tabs (Home, Fitness, Mind, Bond, Community).
  Each screen should pull real data from the Supabase hooks (useDashboard, useFitness,
  useMind, useBond, useCommunity) and render the intended UI from the mockups.

## Known Gotchas
- Windows + Expo: use `--legacy-peer-deps` if peer conflicts arise
- EAS Build required for iOS from Windows (can't build locally)
- Never call both getSession() + onAuthStateChange on mount (duplicate round-trips)
- Barlow now loads via `@expo-google-fonts/*` + `useFonts`; App.js holds a dark
  splash until fonts are ready. Font family names must match `tailwind.config.js`.
- NativeWind pulls in `react-native-reanimated` → `react-native-worklets` transitively.
  Expo Go SDK 54 ships **worklets 0.5.1** natively; npm had resolved 0.8.3, and that
  native↔JS ABI mismatch crashes at launch with `Exception in HostFunction: <unknown>`
  ("runtime not ready"). Fix: pin `react-native-worklets` to `0.5.1` in `package.json`
  dependencies AND `overrides` so the transitive copy matches Expo Go. Verify with
  `npm ls react-native-worklets` (must be 0.5.1, deduped). `expo install --check` does
  NOT catch this on its own because the packages are transitive.
- Entrance animations use RN's built-in `Animated` (`components/FadeInView.tsx`), NOT
  Reanimated — no worklets runtime dependency, so it can't hit the crash above.
- Reanimated worklets babel plugin is auto-injected by babel-preset-expo (SDK 54) when
  the module is present — adding it manually causes a "plugin applied twice" build error.
- After changing native module versions, restart Metro with `npx expo start --clear`.

## Testing
- Run `npx expo start --clear` from `dadhealth-mobile/` (press `i` / scan QR in Expo Go)
- **Onboarding**: reset profile in Supabase SQL Editor:
  `update public.user_profile set onboarding_complete = false, goals = '[]'::jsonb, custody_pattern = null, custody_arrangement = null where user_id = '<your-id>';`
  Then restart the app → Welcome → Goals → Custody → Tabs.
- **Logout**: tap "?" avatar → Account Sheet → Log Out → stays on Home with "?" avatar.
- **Sign in**: tap "?" → Account Sheet → Sign In → sign in → lands on Home with your initial.
- **Biometric enrollment**: after first manual sign-in, "Use Face ID" modal appears.
- Bottom bar matches the mockup: Fit · Mind · **Home (raised lime center)** · Bond · Squad
- Confirm colors match web exactly (lime #C8F55A on dark #0A0A0A)
- No console errors
