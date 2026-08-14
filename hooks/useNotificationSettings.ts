import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

export type NotificationType = 'morning_checkin' | 'bedtime_story' | 'workout_window' | 'weekly_score' | 'streak_at_risk' | 'weekly_challenge' | 'journal_prompt' | 'milestone_anniversary' | 'community_reply' | 'co_parent_event_added' | 'present_dad_mode_complete';
export type NotificationPreference = { notification_type: NotificationType; enabled: boolean; send_time: string | null };

export function useNotificationSettings(userId?: string) {
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const [profileResult, preferencesResult] = await Promise.all([
      supabase.from('user_profile').select('push_notifications_enabled,timezone').eq('user_id', userId).maybeSingle(),
      supabase.from('notification_preferences').select('notification_type,enabled,send_time').eq('user_id', userId),
    ]);
    if (profileResult.error || preferencesResult.error) {
      setError('Notification preferences are temporarily unavailable. Please try again.');
    } else {
      setMasterEnabled(profileResult.data?.push_notifications_enabled === true);
      setTimezone(typeof profileResult.data?.timezone === 'string' ? profileResult.data.timezone : '');
      setPreferences((preferencesResult.data ?? []) as NotificationPreference[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const updateMaster = useCallback(async (enabled: boolean, nextTimezone: string) => {
    if (!userId) return 'Log in to edit notification settings.';
    setSavingKey('master');
    const result = await supabase.from('user_profile').update({ push_notifications_enabled: enabled, timezone: timezone || nextTimezone }).eq('user_id', userId);
    setSavingKey(null);
    if (result.error) return 'Unable to save notification settings. Please try again.';
    setMasterEnabled(enabled);
    if (!timezone) setTimezone(nextTimezone);
    return null;
  }, [timezone, userId]);

  const saveTimezone = useCallback(async (nextTimezone: string) => {
    if (!userId) return 'Log in to edit notification settings.';
    setSavingKey('timezone');
    const result = await supabase.from('user_profile').update({ timezone: nextTimezone }).eq('user_id', userId);
    setSavingKey(null);
    if (result.error) return 'Unable to save your timezone. Please try again.';
    setTimezone(nextTimezone);
    return null;
  }, [userId]);

  const upsertPreference = useCallback(async (type: NotificationType, enabled: boolean, sendTime: string | null) => {
    if (!userId) return 'Log in to edit notification settings.';
    setSavingKey(type);
    const result = await supabase.from('notification_preferences').upsert({ user_id: userId, notification_type: type, enabled, send_time: sendTime }, { onConflict: 'user_id,notification_type' });
    setSavingKey(null);
    if (result.error) return 'Unable to update this notification. Please try again.';
    setPreferences((current) => [...current.filter((preference) => preference.notification_type !== type), { notification_type: type, enabled, send_time: sendTime }]);
    return null;
  }, [userId]);

  return { masterEnabled, timezone, preferences, loading, savingKey, error, refresh, updateMaster, saveTimezone, upsertPreference };
}
