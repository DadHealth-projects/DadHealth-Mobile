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

## Next: Track B (Authentication + Biometric)
- Supabase auth (email/password signup)
- Biometric login (Face ID via expo-local-authentication)
- Session persistence
- Auth guards on tabs
- Profile/logout screen

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
- Run `npx expo start` from `dadhealth-mobile/` (press `i` for iOS / scan QR in Expo Go)
- Verify all 5 tabs navigate
- Confirm colors match web exactly (lime #C8F55A on dark #0A0A0A)
- No console errors
