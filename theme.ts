import { Platform } from 'react-native';

// dadHealth Mobile theme
// Extracted from web (dadHealth/src/index.css + tailwind.config.ts).
//
// Web tokens map (HSL → hex):
//   --primary / --lime  = 78 89% 65%  → #C8F55A  (lime)
//   --background / --dark = 0 0% 4%   → #0A0A0A  (dark bg)
//   --card              = 0 0% 6%     → #111111  (card, ~6% gray)
//   --foreground        = 0 0% 100%   → #FFFFFF  (text)
//   --muted / --border  = 0 0% 12%    → #1F1F1F  (muted / border)
//   --muted-foreground  = 0 0% 78%    → #C7C7C7  (secondary text)
// Fonts: Barlow Condensed (headings), Barlow (body).
// Spacing: 8px increments (xs:4, sm:8, md:16, lg:24, xl:32).

export const colors = {
  lime: '#C8F55A',
  limeHover: '#D5F77E', // --lime-hover 78 89% 72%
  dark: '#0A0A0A',
  card: '#111111',
  text: '#FFFFFF',
  muted: '#1F1F1F',
  border: '#1F1F1F',
  // Softer text tiers pulled from --muted-foreground / --text-tertiary
  mutedText: '#C7C7C7',
  tertiaryText: '#A6A6A6',
};

// Barlow families loaded via expo-font (@expo-google-fonts) in App.js.
export const fonts = {
  heading: 'BarlowCondensed-ExtraBold',
  headingBold: 'BarlowCondensed-Bold',
  headingSemiBold: 'BarlowCondensed-SemiBold',
  body: 'Barlow-Regular',
  bodyMedium: 'Barlow-Medium',
  bodySemiBold: 'Barlow-SemiBold',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Typography helpers matching web patterns (used where JS styles are needed,
// e.g. the React Navigation tab bar which can't take Tailwind classes).
export const typography = {
  // .section-label — uppercase, wide tracking, muted
  sectionLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    letterSpacing: 2.5,
    textTransform: 'uppercase' as const,
    color: colors.mutedText,
  },
  // Hero <h1> — font-heading text-[42px] uppercase leading-none
  title: {
    fontFamily: fonts.heading,
    fontSize: 44,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: colors.text,
    lineHeight: 46,
  },
  // .stat-number — font-heading text-primary
  statNumber: {
    fontFamily: fonts.heading,
    fontSize: 34,
    color: colors.lime,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.mutedText,
    lineHeight: 24,
  },
  // Tab bar label — Barlow, uppercase
  tabLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: colors.text,
  },
};

// Cross-platform depth. iOS uses shadow*, Android uses elevation — kept in JS
// because NativeWind's shadow utilities don't map cleanly to Android elevation.
export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
    },
    android: { elevation: 6 },
    default: {},
  }),
  button: Platform.select({
    ios: {
      shadowColor: colors.lime,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
    default: {},
  }),
  tabBar: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
    },
    android: { elevation: 24 },
    default: {},
  }),
};

export default { colors, fonts, spacing, typography, shadows };
