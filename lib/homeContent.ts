/**
 * Public Home copy + imagery, copied verbatim from the web landing page so both
 * products read identically:
 *   dadHealth/src/components/home/HeroSection.tsx
 *   dadHealth/src/components/home/WhoWeAre.tsx
 *   dadHealth/src/components/home/StatsBar.tsx
 *   dadHealth/src/components/home/PillarsSection.tsx
 *   dadHealth/src/components/home/DadStrengthSection.tsx
 *   dadHealth/src/components/SiteFooter.tsx
 *   dadHealth/src/lib/constants.ts, src/lib/images.ts, src/lib/dadStrengthProgram.ts
 *
 * Nothing here is rewritten for mobile. Only layout changes on this platform.
 */

/** Same Unsplash URLs the web uses (dadHealth/src/lib/images.ts). */
export const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=900&q=80',
  workout: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
  bond: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=900&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
  run: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&q=80',
} as const;

export const HERO = {
  label: 'BUILT FOR DADS, BY DADS',
  titleAccent: 'DAD',
  titleRest: 'HEALTH',
  quote:
    '"1 in 8 men in the UK have experienced mental health symptoms. From Manchester to London, dads are carrying a lot. Be the stronger dad you aspire to be, both mentally and physically."',
  primaryCta: 'START FREE — 7 DAYS →',
  secondaryCta: 'HOW IT WORKS',
} as const;

export const WHO_WE_ARE = {
  label: 'WHO WE ARE',
  heading: 'WHO WE ARE',
  paragraphs: [
    'Dad Health helps men talk openly about mental health - the stigma around it, the anxiety of parenting, and the pressure many dads carry every day across the UK. What we go through, what we worry about, and how we tackle it together.',
    'Through real-life experiences, Dad Health offers exercise and nutrition guidance, practical accountability check-ins, and the motivation to "kill the old version" of yourself in pursuit of the best version for your family.',
    'As a parent-focused community, we also share ideas for days out with the kids, recipes to cook together, healthier takeaway alternatives, and the sort of advice we wish we had sooner.',
  ],
  cta: 'TAKE ACTION →',
} as const;

export const DASHBOARD_SECTION = {
  label: 'YOUR DAILY HUB',
  heading: 'THE DASHBOARD',
  /** Web sidebar screen names, in web order. */
  screens: ['HOME', 'FITNESS', 'MIND', 'BOND', 'COMMUNITY', 'PROGRESS'] as const,
} as const;

/** `STATS_EXTENDED` from dadHealth/src/lib/constants.ts */
export const STATS_EXTENDED = [
  { value: '4.2', sub: 'MILLION', label: 'Men in the UK living with mental health challenges' },
  { value: '60%', sub: '', label: 'Of adult males could be classed as obese by 2050' },
  { value: '4 IN 10', sub: '', label: "Men with mental health concerns won't discuss it with anyone" },
  { value: '18%', sub: '', label: 'UK Dads doing more childcare since pre-pandemic' },
] as const;

export const STATS_FOOTNOTE =
  'THESE FIGURES ARE ON THE RISE. HELP REGAIN CONTROL, AND BE THE BETTER VERSION OF YOU, FOR YOURSELF AND YOUR FAMILY.';

export type PillarTab = 'Fit' | 'Mind' | 'Bond';

/**
 * `PILLARS` from dadHealth/src/lib/constants.ts, with the web `href` mapped to
 * the equivalent mobile tab (`/mind` → Mind, `/fitness` → Fit, `/bond` → Bond).
 */
export const PILLARS: ReadonlyArray<{
  tag: string;
  description: string;
  tab: PillarTab;
  image: string;
}> = [
  {
    tag: 'MENTAL HEALTH',
    description: 'One of the most commonly avoided conversations for men',
    tab: 'Mind',
    image: IMAGES.gym,
  },
  {
    tag: 'FITNESS',
    description: 'It is not too late to start, honestly',
    tab: 'Fit',
    image: IMAGES.run,
  },
  {
    tag: 'NUTRITION',
    description: 'Dialling in your nutrition is step one if you want to lose weight',
    tab: 'Fit',
    image: IMAGES.food,
  },
  {
    tag: 'PARENTING',
    description: 'The never-ending challenge of family life, tackled together',
    tab: 'Bond',
    image: IMAGES.bond,
  },
];

export const PILLARS_SECTION = {
  label: 'THE PILLARS OF OUR HEALTH',
  heading: 'WHAT WE COVER',
  cta: 'LEARN MORE',
} as const;

/** `DAD_STRENGTH_MOVES` from dadHealth/src/lib/dadStrengthProgram.ts */
export type DadStrengthMove = { title: string; detail: string; tag: string };

export const DAD_STRENGTH_MOVES: DadStrengthMove[] = [
  { title: 'Press-up hold', detail: '3 sets · 45 sec', tag: 'Chest' },
  { title: 'Goblet squat', detail: '3 sets · 12 reps', tag: 'Legs' },
  { title: 'Dead bug', detail: '2 sets · 10 reps', tag: 'Core' },
  { title: 'Hip hinge', detail: '3 sets · 15 reps', tag: 'Back' },
  { title: 'Press-up', detail: '3 sets · 10 reps', tag: 'Chest' },
  { title: 'Plank', detail: '3 sets · 45 sec', tag: 'Core' },
];

export const DAD_STRENGTH = {
  label: "TODAY'S WORKOUT",
  fallbackTitle: 'DAD STRENGTH',
  movesLabel: "TODAY'S MOVES",
  timerLabel: 'WORKOUT TIMER',
  timerValue: '00:00',
  startCta: 'START →',
  nextCta: 'NEXT EXERCISE',
  progressLabel: 'PROGRESS THIS MONTH',
  viewCta: 'VIEW FULL FITNESS →',
  statLabels: ['WORKOUTS', 'WEIGHT', 'STEPS', 'ACTIVE TODAY'] as const,
} as const;

export const FOOTER = {
  blurb:
    'Built for dads, by dads. Kill the old version of you. Be the stronger dad — mentally, physically and as a parent.',
  /** Web `FOOTER_LINKS.platform`, mapped to mobile tabs where one exists. */
  platform: [
    { label: 'Home', tab: 'Home' },
    { label: 'Fitness', tab: 'Fit' },
    { label: 'Mental health', tab: 'Mind' },
    { label: 'Bond', tab: 'Bond' },
    { label: 'Community', tab: 'Squad' },
  ] as const,
  /** Web-only pages — opened in the browser, same paths as the site. */
  legal: [
    { label: 'Privacy policy', path: '/privacy' },
    { label: 'Terms and conditions', path: '/terms' },
    { label: 'EULA', path: '/eula' },
    { label: 'Cookie settings', path: '/cookies' },
  ] as const,
  supportLabel: 'SUPPORT',
  supportEmail: 'hello@dadhealth.co.uk',
  copyright: '© 2025 Dad Health. All rights reserved.',
  crisis: { label: 'CRISIS SUPPORT — 116 123', tel: '116123' },
} as const;
