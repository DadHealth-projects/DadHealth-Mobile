/**
 * Pro conversion copy, from the Developer Brief (August 2026) — Change 04.
 *
 * The brief's principle is "do not sell Pro, demonstrate it": every lock shows a
 * preview of what is behind it, and no screen leads with a lock icon. Keeping
 * the copy in one place means the seven upgrade moments and the free/Pro
 * feature-split locks stay worded exactly as Jamie specified, and can be
 * asserted in tests.
 */

export type ProMomentId =
  | 'score'
  | 'checkIn'
  | 'aiWorkout'
  | 'dadDays'
  | 'weeklyReport'
  | 'progressTrends'
  | 'dadDaysCounter';

export type ProMoment = {
  /** Small uppercase label above the heading. Never a lock icon on its own. */
  eyebrow: string;
  heading: string;
  body: string;
  /** Action label. Brief wording, sentence-cased for the native button style. */
  cta: string;
};

/** The seven upgrade moments, in brief order. */
export const PRO_MOMENTS: Record<ProMomentId, ProMoment> = {
  score: {
    eyebrow: 'Your Dad Health Score',
    heading: 'Understand your score',
    body: 'Pro members get personalised insights, weekly trends and recommendations.',
    cta: 'Unlock my insights',
  },
  checkIn: {
    eyebrow: 'After your check-in',
    heading: 'Pro can do more',
    body: 'Get a personalised plan based on your mood, activity and Dad Health Score.',
    cta: 'See what Pro can do',
  },
  aiWorkout: {
    eyebrow: 'AI workout',
    heading: 'Unlimited AI workouts',
    body: "Tell us how much time you have, what equipment you have and how you're feeling. We'll build your workout around you.",
    cta: 'Unlock AI workouts',
  },
  dadDays: {
    eyebrow: 'Dad Days',
    heading: 'Make it personal',
    body: "Child's age · Budget · Time available · Distance · What they enjoy",
    cta: 'Personalise my Dad Days',
  },
  weeklyReport: {
    eyebrow: 'Every Sunday',
    heading: 'Your week in Dad Health',
    body: 'Weekly Mind, Body and Bond movement, what caused it and where to put next week.',
    cta: 'Available with Pro',
  },
  progressTrends: {
    eyebrow: 'Your progress',
    heading: 'See how your score has changed',
    body: 'Pro members see the trend behind every workout, check-in and Bond moment.',
    cta: 'View your trends',
  },
  dadDaysCounter: {
    eyebrow: 'Dad Days',
    heading: 'Get unlimited Dad Days',
    body: 'Get unlimited personalised Dad Days searches.',
    cta: 'Upgrade to Pro',
  },
};

export type ProLockId =
  | 'mindPlan'
  | 'moodTrends'
  | 'fullTdee'
  | 'mealPlanner'
  | 'monthlyReport'
  | 'milestonePhotos'
  | 'trainingPlans'
  | 'familyActivityPlans';

/**
 * Free vs Pro feature-split locks (brief Change 04 table). Each one is rendered
 * over a visible preview of the real feature, never as a bare paywall.
 */
export const PRO_LOCKS: Record<ProLockId, ProMoment> = {
  mindPlan: {
    eyebrow: 'Pro',
    heading: 'Get a personalised plan',
    body: 'Built from your mood, score and history — so the next step is already chosen for you.',
    cta: 'See what Pro can do',
  },
  moodTrends: {
    eyebrow: 'Mood trends',
    heading: 'Seven days of mood',
    body: 'Pro members see how their mood is moving, and what it tracks with.',
    cta: 'Unlock mood trends',
  },
  fullTdee: {
    eyebrow: 'Full TDEE',
    heading: 'Your calorie targets',
    body: 'Pro members get every target — maintenance, fat loss, lean bulk — with insights for their numbers.',
    cta: 'Unlock full TDEE',
  },
  mealPlanner: {
    eyebrow: 'Meal planner',
    heading: 'Five days, one shopping list',
    body: 'Pro members generate a personalised week of meals with macros and a shopping list.',
    cta: 'Unlock the meal planner',
  },
  monthlyReport: {
    eyebrow: 'Monthly summary',
    heading: 'Your month in Dad Health',
    body: 'Pro members get the full monthly report, and can save or share it.',
    cta: 'Unlock my reports',
  },
  milestonePhotos: {
    eyebrow: 'Milestone photos',
    heading: 'Words are good. Photos last forever.',
    body: 'Logging milestones is free. Pro members add photos and see milestone insights.',
    cta: 'Unlock milestone photos',
  },
  trainingPlans: {
    eyebrow: 'Training plans',
    heading: 'A plan that fits your week',
    body: 'Pro members get structured training plans built around their time, equipment and goals.',
    cta: 'Unlock training plans',
  },
  familyActivityPlans: {
    eyebrow: 'Family activity plans',
    heading: 'More time that counts',
    body: 'Pro members get personalised activity plans built around your family and the time you have together.',
    cta: 'Unlock family plans',
  },
};

/**
 * Brief Change 02, position 3: the Home Pro tease leads with the dad's own
 * improvement, not with the lock — "You've improved your Body score by 6% this
 * week." Returns `null` when nothing improved, so the tease falls back to the
 * Moment 1 wording instead of inventing progress.
 */
export function proScoreTease(trend: readonly [string, number] | null): string | null {
  if (!trend) return null;
  const [pillar, change] = trend;
  const rounded = Math.round(change);
  if (rounded <= 0) return null;
  return `You've improved your ${pillar} score by ${rounded}% this week.`;
}
