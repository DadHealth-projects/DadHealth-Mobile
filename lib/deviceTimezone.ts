import { supabase } from './supabase';

type ProfileClient = Pick<typeof supabase, 'from'>;

/** The phone's IANA timezone, or null when the platform cannot report one. */
export function currentDeviceTimezone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === 'string' && zone.trim() ? zone : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the account timezone (reminders, quiet hours, scoring day) on the phone's
 * timezone. Writes only when it differs. The backend validates the name and
 * applies a scoring-day change from the next scoring week, keeping history fixed.
 */
export async function syncProfileTimezone(
  userId: string,
  deviceTimezone: string | null,
  client: ProfileClient = supabase,
): Promise<'updated' | 'unchanged' | 'skipped' | 'failed'> {
  if (!userId || !deviceTimezone) return 'skipped';
  const profile = await client.from('user_profile').select('timezone').eq('user_id', userId).maybeSingle();
  if (profile.error) return 'failed';
  // No profile yet (onboarding not finished): nothing to update.
  if (!profile.data) return 'skipped';
  if (profile.data.timezone === deviceTimezone) return 'unchanged';
  const update = await client.from('user_profile').update({ timezone: deviceTimezone }).eq('user_id', userId);
  return update.error ? 'failed' : 'updated';
}
