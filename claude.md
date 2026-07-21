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

## Onboarding (kept, but NOT gated in M1)
- `screens/OnboardingScreen.tsx`, `lib/onboarding.ts`, and AuthContext's
  `onboardingComplete` / `refreshOnboarding` are intact and available for the
  milestone where onboarding is implemented. RootNavigator no longer blocks Home
  behind them. No new onboarding behavior was added for this milestone.

## M1 notes / follow-ups
- **Email confirmation** is a Supabase Auth dashboard setting on the shared prod
  project (`vpshxswclkczbjtiyirc`) — it can't be toggled from mobile code, and
  disabling it affects web too. For dev/testing, disable "Confirm email" in the
  Supabase dashboard so email+password sign-in works without confirmation.
- Center tab = Home/Dad Score (the flagship + landing). If the client wants the
  center to be a dedicated Progress/Score screen instead, it's a one-line change
  in `TAB_META` + a new screen.

## Authentication flow (production / "banking app" behaviour)
Session logic is copied from the web (single `onAuthStateChange`, SecureStore
persistence) — the mobile flow only adds the biometric-first gating on top.

- **Launch**: `RootNavigator` → `loading ? Splash`. If a Supabase session is
  restored → straight to `AppNavigator` (Home). No session → `UnauthedFlow`.
- `contexts/UnauthedFlow.tsx` — the signed-out experience: if biometrics are
  available AND enrolled → `BiometricGate` (auto-prompts Face ID/Touch ID on mount,
  no button tap). Otherwise → `LoginScreen`. The login form is the LAST fallback.
- `components/BiometricGate.tsx` — auto-prompts on mount; success signs in via
  stored creds (session flips, tree swaps to Home); failure/cancel shows retry +
  "Use password instead" → LoginScreen.
- **Logout** happens ONLY from Profile → clears session → `UnauthedFlow` re-runs →
  auto biometric again if still enabled (creds are kept on logout by design; the
  user can cancel to reach the login form, or disable Face ID in Profile).
- **Interpretation note**: the brief's flowchart says *session exists → Dashboard*,
  so we do NOT force Face ID when a valid session is already restored. Biometric
  gating triggers only when there is no session (fresh install, expiry, logout).

## Biometric enrollment (opt-in — no silent saving)
- `AuthContext.signIn` no longer saves credentials silently. On a successful
  password sign-in (biometrics available + not already enrolled) it stages the
  creds **in memory only** (`pendingBiometricEnrollment`, email exposed / password
  private).
- `components/BiometricEnrollmentModal.tsx` shows over the dashboard: *"Use Face ID
  to sign in next time?"* → **Enable** persists creds to the keychain; **Not Now**
  discards them. Also disable-able later in Profile → Settings.
- Face ID / OAuth sign-ins don't trigger enrollment (Face ID is already enrolled;
  OAuth has no password to store — biometric unlock is password-credential based).

## Login screen (`screens/LoginScreen.tsx`)
- Modes mirror the web `AuthModal`: **signin / signup / forgot**.
- Email+password sign-in & create-account, **Forgot password** (Supabase
  `resetPasswordForEmail`, `redirectTo` the web `/auth/callback?next=/auth/reset-password`),
  Google + Apple buttons, and the Face ID fallback button (when enrolled).
- Apple button only renders when `isAppleAuthAvailable()` (iOS + module present).

## OAuth (`lib/oauth.ts`) — needs external setup + a DEV BUILD
Client code is done and typechecks, but Google/Apple will NOT function in Expo Go:
- **Google**: `supabase.auth.signInWithOAuth` → `expo-web-browser` in-app browser →
  redirect back to `dadhealth://auth/callback` (scheme already in `app.json`) →
  PKCE `exchangeCodeForSession` (or implicit `setSession`). Requires a dev build
  (custom-scheme redirect isn't available in Expo Go) + Supabase Google provider +
  the redirect URL allow-listed + Google OAuth client IDs.
- **Apple**: `expo-apple-authentication` native sheet → `supabase.auth.signInWithIdToken`.
  Requires `usesAppleSignIn: true` + the `expo-apple-authentication` plugin (both
  added to `app.json`), a dev build, an Apple Services ID, and the Supabase Apple
  provider configured for bundle id `co.uk.dadhealth`.
- Added deps: `expo-web-browser`, `expo-auth-session`, `expo-apple-authentication`,
  `expo-crypto` (via `npx expo install`). Both providers fail gracefully (clear
  error, no crash) until the above config + dev build exist.

## Account UX Refactor — Phase 1 ✅ (UX-only, no auth changes)
Replaced the avatar → direct-navigation with a modern animated **Account Sheet**
(Apple Fitness / Spotify / GitHub Mobile style). No auth/Supabase/biometric/session
/onboarding logic was touched.
- `components/AccountSheet.tsx` — custom bottom sheet (props: `visible`, `onClose`;
  everything else from `useAuth()`). Owns overlay/backdrop/animation/rows/gestures.
  Built on RN's built-in `Animated` + `Modal` (NOT Reanimated — same worklets-crash
  reason as `FadeInView`). Slide-up `translateY` + backdrop fade (300ms, rgba(0,0,0,0.55)),
  `bg-card` + `rounded-t-card` + 24px padding. Rows are 56px, Feather icon left /
  title center / chevron right, 16px spacing. Dismiss on backdrop tap, Android back
  (`onRequestClose`), and drag-down (PanResponder, >110px or fast flick).
  - Logged OUT: Sign In · Settings · Help & Support.
  - Logged IN: My Profile · Settings · Help & Support · ── · Log Out (red).
  - Sign In → close then `navigate('Login')`. My Profile → `Profile`. Settings →
    `Settings`. Help → `Linking.openURL(WEB_URL/help)`. Log Out → `onClose()` +
    existing `signOut()` (auth listener drops to UnauthedFlow — nothing duplicated).
- `components/ScreenScaffold.tsx` — avatar no longer navigates; holds
  `accountOpen` state, opens `<AccountSheet/>`. `AccountButton` now takes `onPress`.
- `screens/SettingsScreen.tsx` — new placeholder ("Coming Soon"), added to AppNavigator.
- `navigation/AppNavigator.tsx` — registered `Settings` screen (type already existed).
- `screens/ProfileScreen.tsx` — removed the Log Out section (+ `signingOut`/`signOut`/
  `ActivityIndicator`/`handleSignOut`); Profile is now reached ONLY via the sheet.
- Untouched (per brief): AuthContext, RootNavigator, LoginScreen, supabase.ts,
  biometric.ts, secureStore.ts, BottomTabNavigator.
- Note: brief listed Profile as "only Avatar/Email/Member Since/Subscription/
  Connected Devices/Biometric" — those extra sections have no data source yet, so
  Phase 1 only removed Log Out and kept the existing identity + biometric + web-
  dashboard content. Add the new sections when their data lands.

## Next milestone
- (define next milestone)

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
- LoginScreen shows first; sign in with a web test account → lands on **Home** (center tab)
- Bottom bar matches the mockup: Fit · Mind · **Home (raised lime center)** · Bond · Squad
- Tap the top-right account avatar (any pillar screen) → Profile modal → Log Out returns to LoginScreen
- Kill & reopen the app while signed in → auto-logs in (SecureStore session)
- Face ID: after one manual sign-in, "Log in with Face ID" appears on LoginScreen
- Confirm colors match web exactly (lime #C8F55A on dark #0A0A0A)
- No console errors
