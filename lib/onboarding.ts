// Phase 1 onboarding contract — mirrors the web (dadHealth Phase1OnboardingModal
// + OnboardingCheck) so mobile writes compatible data to public.user_profile.

export type OnboardingProfile = {
  display_name?: string | null;
  parent_type?: string | null;
  pronouns?: string | null;
  custody_arrangement?: string | null;
  kids_ages?: string[] | null;
};

export const PARENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'dad', label: 'Dad' },
  { value: 'stepdad', label: 'Stepdad' },
  { value: 'granddad', label: 'Granddad' },
  { value: 'co_parent', label: 'Co-parent' },
  { value: 'same_sex_parent', label: 'Same-sex parent' },
  { value: 'non_binary_parent', label: 'Non-binary parent' },
  { value: 'other', label: 'Other' },
];

export const PRONOUN_OPTIONS: { value: string; label: string }[] = [
  { value: 'he_him', label: 'He / Him' },
  { value: 'she_her', label: 'She / Her' },
  { value: 'they_them', label: 'They / Them' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const CUSTODY_OPTIONS: { value: string; label: string; hint?: string }[] = [
  { value: 'daily', label: 'Every day', hint: 'I live with my kids full-time' },
  { value: 'most_days', label: 'Most days' },
  { value: 'alternate_weeks', label: 'Alternate weeks' },
  { value: 'occasional', label: 'Occasionally', hint: 'Weekends or specific days' },
  { value: 'flexible', label: 'Flexible / it varies' },
];

export const KIDS_AGES_OPTIONS: { value: string; label: string }[] = [
  { value: 'toddler_0_4', label: 'Toddler (0–4)' },
  { value: 'primary_5_11', label: 'Primary (5–11)' },
  { value: 'teen_12_plus', label: 'Teen (12+)' },
  { value: 'adult_18_plus', label: 'Adult (18+)' },
];

/**
 * Phase 1 is complete once the four required fields are saved. Pronouns (Q3) is
 * optional per the onboarding spec, so it's not part of the check. Identical to
 * the web `isPhase1Complete`.
 */
export function isPhase1Complete(profile: OnboardingProfile | null | undefined): boolean {
  if (!profile) return false;
  if (!profile.display_name || !profile.display_name.trim()) return false;
  if (!profile.parent_type) return false;
  if (!profile.custody_arrangement) return false;
  const ages = profile.kids_ages;
  if (!Array.isArray(ages) || ages.length === 0) return false;
  return true;
}
