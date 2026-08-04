import type { User } from '@supabase/supabase-js';

/**
 * Greeting name resolution, ported from `dadHealth/src/lib/userDisplay.ts` so
 * the dashboard greets a member with exactly the name the web greets them with.
 */

/** Dashboard greeting when every candidate looks like an email/username handle. */
export const DASHBOARD_GREETING_FALLBACK = 'Dad';

/** True when the string should not be used as a human greeting. */
function isEmailLikeOrUsernameHandle(value: string, email?: string | null): boolean {
  const text = value.trim();
  if (!text) return true;
  const local = email?.split('@')[0]?.toLowerCase() ?? '';
  const lower = text.toLowerCase();
  if (local && lower === local) return true;
  if (local && lower.replace(/[._-]/g, '') === local.replace(/[._-]/g, '')) return true;
  if (local && lower.length >= 8 && local.startsWith(lower) && lower !== local) return true;
  if (!/\s/.test(text) && /\d/.test(text) && /^[a-z0-9._-]+$/i.test(text)) return true;
  if (!/\s/.test(text) && lower.length >= 14 && /^[a-z0-9._-]+$/i.test(text)) return true;
  return false;
}

export function greetingDisplayName(
  profileDisplayName: string | null | undefined,
  user: User | null | undefined,
): string {
  if (!user) return DASHBOARD_GREETING_FALLBACK;
  const email = user.email ?? undefined;
  const meta = user.user_metadata as Record<string, unknown> | undefined;

  const candidates: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
  };
  push(profileDisplayName);
  push(meta?.full_name);
  push(meta?.name);
  push(meta?.display_name);
  push(meta?.preferred_username);

  for (const candidate of candidates) {
    if (!isEmailLikeOrUsernameHandle(candidate, email)) return candidate;
  }
  return DASHBOARD_GREETING_FALLBACK;
}

/** Web shows only the first word of the greeting name on the dashboard. */
export function greetingFirstName(
  profileDisplayName: string | null | undefined,
  user: User | null | undefined,
): string {
  const name = greetingDisplayName(profileDisplayName, user);
  return name.split(/\s+/)[0] ?? name;
}
