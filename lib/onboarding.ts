export type OnboardingProfile = {
  goals?: string[] | null;
  custody_pattern?: string | null;
  onboarding_complete?: boolean | null;
};

export const GOALS = [
  { icon: '🧠', title: 'I want to be more present', sub: 'Phone down, eyes up — actually there' },
  { icon: '💚', title: "I'm struggling and not saying so", sub: 'Mental health, stress, or just running on empty' },
  { icon: '💪', title: 'I want to get physically healthier', sub: 'Lose weight, build fitness, feel better' },
  { icon: '💔', title: "I'm going through a tough chapter", sub: 'Separation, co-parenting, or doing it alone' },
  { icon: '🗓️', title: 'I want to find things to do with my kids', sub: 'Activities, days out, quality time ideas' },
  { icon: '⭐', title: 'I just want to be a better dad', sub: "No specific reason. That's enough." },
] as const;

export const CUSTODY_OPTIONS = [
  { value: 'daily', icon: '👨‍👧', label: 'Every day', sub: "I'm with my kids daily" },
  { value: 'split', icon: '🔄', label: '50/50', sub: 'Shared custody, roughly equal time' },
  { value: 'weekends', icon: '🗓️', label: 'Occasionally — weekends or specific days', sub: 'Set days each week or every other weekend' },
  { value: 'varies', icon: '🔀', label: 'Flexible — it varies', sub: 'No fixed pattern, changes week to week' },
] as const;

export type CustodyPattern = (typeof CUSTODY_OPTIONS)[number]['value'];

export const LEGACY_CUSTODY_MAP: Record<CustodyPattern, string> = {
  daily: 'daily',
  split: 'alternate_weeks',
  weekends: 'occasional',
  varies: 'flexible',
};

/**
 * M2.1 is complete only when BOTH new-style fields are present: at least one
 * goal AND a custody pattern. The legacy `onboarding_complete` flag (set by the
 * old web goals flow) is deliberately NOT trusted — it predates custody
 * selection, so existing accounts are routed through the new onboarding once.
 */
export function isOnboardingComplete(profile: OnboardingProfile | null | undefined): boolean {
  if (!profile) return false;
  return (
    Array.isArray(profile.goals) &&
    profile.goals.length > 0 &&
    Boolean(profile.custody_pattern)
  );
}

type SupabaseErrorShape = { code?: string; message?: string; details?: string; hint?: string };

/** Maps database failures to practical inline guidance without exposing provider text. */
export function onboardingSaveErrorMessage(error: unknown): string {
  const detail: SupabaseErrorShape = typeof error === 'object' && error !== null
    ? error as SupabaseErrorShape
    : {};
  const code = detail.code ?? '';
  const message = detail.message?.toLowerCase() ?? '';
  if (code === '23502' || code === '23514' || message.includes('violates')) {
    return 'That selection could not be saved. Please check it and try again.';
  }
  if (code === '42501' || message.includes('row-level security') || message.includes('permission')) {
    return "We couldn't verify your account. Please sign in again and retry.";
  }
  if (code === '42703' || message.includes('custody_pattern')) {
    return 'Your app database needs a quick update before this can be saved. Please contact support.';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'Check your connection, then try again.';
  }
  if (code === '429' || message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment, then try again.';
  }
  return 'We could not save your choices just now. Please try again.';
}
