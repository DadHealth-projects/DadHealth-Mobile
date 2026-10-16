export const PRO_FEATURE_ACCESS = Object.freeze({
  mind_plan: 'pro',
  ai_workout: 'pro',
  workout_library: 'pro',
  meal_planner: 'pro',
  score_insights: 'pro',
  trends: 'pro',
  weekly_report: 'pro',
  dad_days_unlimited: 'pro',
  streak_freeze: 'pro',
  full_tdee: 'pro',
  milestone_photos: 'pro',
  free_weekly_workout: 'free',
});

export function canAccessFeature(featureKey, isPro, trialActive) {
  const requiredAccess = PRO_FEATURE_ACCESS[featureKey];
  if (!requiredAccess) return false;
  if (requiredAccess === 'free') return true;
  if (isPro !== true && isPro !== false) return null;
  return isPro || trialActive === true;
}
