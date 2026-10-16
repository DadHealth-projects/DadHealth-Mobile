export const PRO_FEATURE_ACCESS: Readonly<{
  mind_plan: 'pro';
  ai_workout: 'pro';
  workout_library: 'pro';
  meal_planner: 'pro';
  score_insights: 'pro';
  trends: 'pro';
  weekly_report: 'pro';
  dad_days_unlimited: 'pro';
  streak_freeze: 'pro';
  full_tdee: 'pro';
  milestone_photos: 'pro';
  free_weekly_workout: 'free';
}>;

export type ProFeatureKey = keyof typeof PRO_FEATURE_ACCESS;

export function canAccessFeature(
  featureKey: ProFeatureKey,
  isPro: boolean | null,
  trialActive: boolean | null,
): boolean | null;
