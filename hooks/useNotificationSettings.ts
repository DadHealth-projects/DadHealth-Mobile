import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { supabase } from '../lib/supabase';
import { reminderTimeError } from '../lib/reminderTime';

export type NotificationType = 'morning_checkin' | 'lowest_pillar' | 'trial_ending' | 'community_like' | 'bedtime_story' | 'workout_window' | 'weekly_score' | 'streak_at_risk' | 'weekly_challenge' | 'journal_prompt' | 'milestone_anniversary' | 'community_reply' | 'co_parent_event_added' | 'present_dad_mode_complete';
export type NotificationPreference = { notification_type: NotificationType; enabled: boolean; send_time: string | null };


const empty = { masterEnabled: false, timezone: '', preferences: [] as NotificationPreference[], loading: true, savingKey: null as string | null, error: null as string | null };
export function useNotificationSettings(userId?: string) {
  const { isOffline } = useNetworkStatus();
  const scope = useMemo(() => ({ owner: userId, alive: true, generation: 0, writing: false }), [userId]);
  const current = useRef(scope); current.current = scope;
  const [stored, setStored] = useState({ scope, value: empty });
  const value = stored.scope === scope ? stored.value : empty;
  const valid = useCallback(() => scope.alive && current.current === scope, [scope]);
  const update = useCallback((patch: Partial<typeof empty>) => {
    if (valid()) setStored(previous => ({ scope, value: { ...(previous.scope === scope ? previous.value : empty), ...patch } }));
  }, [scope, valid]);
  const refresh = useCallback(async () => {
    if (scope.writing) return;
    if (!userId || isOffline) { update({ loading: false }); return; }
    const generation = ++scope.generation;
    update({ loading: true, error: null });
    try {
      const [profile, prefs] = await Promise.all([
        supabase.from('user_profile').select('push_notifications_enabled,timezone').eq('user_id', userId).maybeSingle(),
        supabase.from('notification_preferences').select('notification_type,enabled,send_time').eq('user_id', userId),
      ]);
      if (!valid() || generation !== scope.generation) return;
      if (profile.error || prefs.error) throw new Error('preferences');
      update({ masterEnabled: profile.data?.push_notifications_enabled === true,
        timezone: profile.data?.timezone ?? '', preferences: (prefs.data ?? []) as NotificationPreference[], error: null });
    } catch { if (valid() && generation === scope.generation) update({ error: 'Notification preferences are temporarily unavailable. Please try again.' }); }
    finally { if (valid() && generation === scope.generation) update({ loading: false }); }
  }, [userId, isOffline, scope, valid, update]);
  useEffect(() => { scope.alive = true; void refresh(); return () => { scope.alive = false; scope.generation++; }; }, [scope, refresh]);

  const write = useCallback(async (key: string, action: () => PromiseLike<{ error: unknown }>, apply: () => void) => {
    if (!userId || !valid()) return 'Log in to edit notification settings.';
    if (isOffline) return 'Reconnect to save notification settings.';
    if (scope.writing) {
  return 'Please wait for your current change to finish saving.';
    }
    scope.writing = true; scope.generation++; update({ savingKey: key, loading: false });
    try {
      const session = await supabase.auth.getSession();
      if (!valid() || session.data.session?.user.id !== userId) return null;
      const result = await action();
      if (!valid()) return null;
      if (result.error) throw result.error;
      apply(); return null;
    } catch { return valid() ? 'Unable to save notification settings. Please try again.' : null; }
    finally { scope.writing = false; if (valid()) update({ savingKey: null }); }
  }, [userId, isOffline, scope, valid, update]);
  const updateMaster = useCallback((enabled: boolean, nextTimezone: string) => write('master',
    () => supabase.from('user_profile').update({ push_notifications_enabled: enabled, timezone: value.timezone || nextTimezone }).eq('user_id', userId!),
    () => update({ masterEnabled: enabled, timezone: value.timezone || nextTimezone })), [write, userId, value.timezone, update]);
  const saveTimezone = useCallback((timezone: string) => write('timezone',
    () => supabase.from('user_profile').update({ timezone }).eq('user_id', userId!),
    () => update({ timezone })), [write, userId, update]);
  const upsertPreference = useCallback((type: NotificationType, enabled: boolean, sendTime: string | null) => {
    // Only schedulable reminder times are saved; the reason is stated, never silently corrected.
    if (enabled && type === 'morning_checkin' && sendTime !== null) {
      const invalid = reminderTimeError(sendTime);
      if (invalid) return Promise.resolve(invalid);
    }
    const time = type === 'morning_checkin' ? sendTime ?? '08:00:00' : sendTime;
    return write(type, () => supabase.from('notification_preferences').upsert({ user_id: userId!, notification_type: type, enabled, send_time: time }, { onConflict: 'user_id,notification_type' }),
      () => setStored(previous => ({ scope, value: { ...(previous.scope === scope ? previous.value : empty), preferences: [
        ...(previous.scope === scope ? previous.value.preferences : []).filter(p => p.notification_type !== type),
        { notification_type: type, enabled, send_time: time },
      ] } })));
  }, [write, userId, scope]);
  return { ...value, refresh, updateMaster, saveTimezone, upsertPreference };
}
