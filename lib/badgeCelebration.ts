export type EarnedBadge = { icon: string; name: string };

/**
 * Badges earned since the account last saw its list. Awarding is server-only;
 * this only decides what to celebrate. With no saved baseline (first run on
 * this device) nothing is celebrated, so historical badges never pop up.
 */
export function newlyEarnedBadges(earned: readonly EarnedBadge[], seen: readonly string[] | null): EarnedBadge[] {
  if (!seen) return [];
  const known = new Set(seen);
  const fresh = new Map<string, EarnedBadge>();
  for (const badge of earned) if (!known.has(badge.name) && !fresh.has(badge.name)) fresh.set(badge.name, badge);
  return [...fresh.values()];
}

export function celebrationText(badges: readonly EarnedBadge[]): string | null {
  if (!badges.length) return null;
  if (badges.length === 1) return `Badge earned: ${badges[0].name}. Nice work.`;
  return `${badges.length} new badges earned: ${badges.map((badge) => badge.name).join(', ')}. Nice work.`;
}
