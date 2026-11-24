import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import ScreenErrorNotice from '../../components/ScreenErrorNotice';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { useNotificationSettings, type NotificationType } from '../../hooks/useNotificationSettings';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';
import { REMINDER_TIMES } from '../../lib/reminderTime';
import { requestPushPermission } from '../../lib/pushNotifications';

const TYPES: Array<{ type: NotificationType; title: string; description: string; linkLabel: string; needsTime?: boolean; timeHint?: string }> = [
  { type: 'morning_checkin', title: 'Daily check-in reminder', description: 'A reminder if you have not checked in today.', linkLabel: 'Daily check-in', needsTime: true, timeHint: 'Reminder time' },
  { type: 'lowest_pillar', title: 'Lowest-pillar suggestion', description: 'A small step for your lowest pillar after your daily check-in.', linkLabel: 'Suggested activity' },
  { type: 'trial_ending', title: 'Trial reminder', description: 'A reminder to review your plan before your trial ends.', linkLabel: 'Your plan' },
  { type: 'bedtime_story', title: 'Bedtime story reminder', description: '30 minutes before your set bedtime - Bedtime in 30 minutes. Story time?', linkLabel: 'Bond', needsTime: true, timeHint: 'Bedtime' },
  { type: 'workout_window', title: 'Workout window', description: 'At your set time - Your workout window is now. 20 minutes is enough.', linkLabel: 'Body', needsTime: true, timeHint: 'Workout time' },
  { type: 'weekly_score', title: 'Weekly report ready', description: 'Your report is available Sunday at 6am UK time. Alerts arrive outside quiet hours.', linkLabel: 'Weekly report' },
  { type: 'streak_at_risk', title: 'Streak at risk', description: 'The previous 21:00 reminder is paused during quiet hours.', linkLabel: 'Home' },
  { type: 'weekly_challenge', title: 'Weekly challenge', description: 'A new challenge to try each Monday.', linkLabel: 'Home' },
  { type: 'journal_prompt', title: 'Journal prompt', description: 'A little encouragement to reflect on your day.', linkLabel: 'Mind', needsTime: true, timeHint: 'Evening time' },
  { type: 'milestone_anniversary', title: 'Milestone anniversary', description: 'A reminder of a milestone from this day last year.', linkLabel: 'Bond' },
  { type: 'community_like', title: 'Community likes', description: 'When someone likes your community post or comment.', linkLabel: 'Community' },
  { type: 'community_reply', title: 'Community replies', description: 'When someone replies to your community post or comment.', linkLabel: 'Community' },
  { type: 'co_parent_event_added', title: 'Co-parent events', description: 'When a co-parent adds an event to your shared calendar.', linkLabel: 'Bond' },
  { type: 'present_dad_mode_complete', title: 'Present Dad Mode complete', description: 'After you complete a full 60-minute session.', linkLabel: 'Bond' },
];

const DEFAULT_TIMES: Partial<Record<NotificationType, string>> = { morning_checkin: '08:00:00', bedtime_story: '20:00:00', workout_window: '12:00:00', journal_prompt: '20:30:00' };

export default function NotificationSettingsScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const settings = useNotificationSettings(user?.id);
  const deviceTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const owner = useRef(user?.id); owner.current = user?.id;
  useEffect(() => { setMessage(null); setPickerType(null); }, [user?.id]);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerType, setPickerType] = useState<NotificationType | null>(null);
  const [pickerValue, setPickerValue] = useState(new Date());
  const preferenceFor = useCallback((type: NotificationType) => settings.preferences.find((preference) => preference.notification_type === type), [settings.preferences]);

  const toggleMaster = useCallback(async (enabled: boolean) => {
    if (isOffline) { showOfflineAction('notification_settings'); return; }
    setMessage(null);
    const operationOwner = user?.id;
    let permissionGranted = true;
    let permissionConfigured = true;
    if (enabled) {
      try {
        const permission = await requestPushPermission();
        permissionConfigured = permission.configured;
        permissionGranted = permission.granted;
      } catch {
        permissionConfigured = false;
        permissionGranted = false;
      }
    }
    if (owner.current !== operationOwner) return;
    const updateError = await settings.updateMaster(enabled, deviceTimezone);
    if (owner.current !== operationOwner) return;
    if (updateError) setMessage(updateError);
    else if (!enabled) setMessage('Push notifications disabled.');
    else if (!permissionConfigured) setMessage('Your notification choices were saved, but push alerts are unavailable in this version of Dad Health. Update the app, then try again.');
    else if (!permissionGranted) setMessage('Your notification choices were saved. Allow notifications in your device settings to receive alerts.');
    else setMessage('Push notifications enabled.');
  }, [deviceTimezone, isOffline, settings.updateMaster, showOfflineAction, user?.id]);

  const togglePreference = useCallback(async (type: NotificationType, enabled: boolean) => {
    if (isOffline) { showOfflineAction('notification_settings'); return; }
    setMessage(null);
    const operationOwner = user?.id;
    const existing = preferenceFor(type);
    const definition = TYPES.find((item) => item.type === type);
    const sendTime = enabled && definition?.needsTime && !existing?.send_time ? DEFAULT_TIMES[type] ?? null : existing?.send_time ?? null;
    const updateError = await settings.upsertPreference(type, enabled, sendTime);
    if (owner.current !== operationOwner) return;
    if (updateError) setMessage(updateError);
  }, [isOffline, preferenceFor, settings.upsertPreference, showOfflineAction, user?.id]);

  const openTimePicker = useCallback((type: NotificationType) => {
    const value = timeToDate(preferenceFor(type)?.send_time ?? DEFAULT_TIMES[type] ?? '12:00:00');
    setPickerValue(value);
    setPickerType(type);
  }, [preferenceFor]);

  const saveTime = useCallback(async (type: NotificationType, value: Date) => {
    if (isOffline) { showOfflineAction('notification_settings'); return; }
    setMessage(null);
    const operationOwner = user?.id;
    const updateError = await settings.upsertPreference(type, preferenceFor(type)?.enabled ?? true, dateToPgTime(value));
    if (owner.current !== operationOwner) return;
    if (updateError) setMessage(updateError);
    else if (owner.current === operationOwner) setMessage('Notification time saved.');
  }, [isOffline, preferenceFor, settings.upsertPreference, showOfflineAction, user?.id]);

  const onPickerChange = useCallback((event: DateTimePickerEvent, value?: Date) => {
    if (event.type === 'dismissed') { setPickerType(null); return; }
    if (!value || !pickerType) return;
    setPickerValue(value);
    if (Platform.OS !== 'ios') { const type = pickerType; setPickerType(null); void saveTime(type, value); }
  }, [pickerType, saveTime]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="Settings" headline={'Push\nnotifications'} sub="These settings control phone alerts. Your updates remain available in Notifications." />
        <ScreenErrorNotice message={settings.error} />

        {!user ? <Pressable onPress={() => navigation.navigate('Login')} className="min-h-[48px] justify-center border-y border-border"><Text className="font-heading-bold text-lime text-[12px] uppercase">Log in to edit settings</Text></Pressable> : settings.loading ? <View className="gap-sm">{[0,1,2,3].map((item) => <View key={item} className="h-[72px] bg-white/5" />)}</View> : <>
          <View className="border-t border-border">
            <SettingToggleRow title="Enable push notifications" description="Required for all notification types." value={settings.masterEnabled} disabled={settings.savingKey !== null} onChange={(value) => void toggleMaster(value)} />
            <View className="min-h-[62px] flex-row items-center gap-md border-b border-border py-sm"><View className="flex-1"><Text className="font-heading-bold text-white text-[13px] uppercase">Timezone</Text><Text className="font-body text-tertiary-text text-[14px] leading-[20px] mt-xs">{settings.timezone || 'Not set'}</Text></View><Pressable onPress={() => isOffline ? showOfflineAction('notification_settings') : void settings.saveTimezone(deviceTimezone).then(message => { if (owner.current === user?.id) setMessage(message); })} disabled={settings.savingKey !== null} className="min-h-[40px] justify-center border-b border-lime"><Text className="font-heading-bold text-lime text-[12px] uppercase">Use device timezone</Text></Pressable></View>
          </View>

          <View className="border-t border-border">
            {TYPES.filter(definition => definition.type !== 'streak_at_risk').map((definition) => {
              const preference = preferenceFor(definition.type);
              const disabled = !settings.masterEnabled || settings.savingKey !== null;
            return <View key={definition.type} className="border-b border-border py-md gap-sm"><View className="flex-row items-start gap-md"><View className="flex-1"><Text className="font-heading-bold text-white text-[13px] uppercase">{definition.title}</Text><Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">{definition.description}</Text>{definition.type === 'morning_checkin' && preference?.send_time === '07:30:00' ? <Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">Your saved 07:30 reminder arrives at 08:00, outside quiet hours. Choose a new time to update your preference.</Text> : null}<Text className="font-heading-bold text-lime text-[12px] uppercase mt-xs">Opens: {definition.linkLabel}</Text></View><NotificationSwitch value={Boolean(preference?.enabled)} onChange={(value) => void togglePreference(definition.type, value)} disabled={disabled} /></View>{definition.needsTime ? <Pressable onPress={() => openTimePicker(definition.type)} disabled={disabled} className="min-h-[40px] flex-row items-center justify-between border-t border-border pt-sm"><Text className="font-heading-bold text-tertiary-text text-[14px] leading-[20px] uppercase">{definition.timeHint}</Text><View className="flex-row items-center gap-sm"><Text className="font-heading-bold text-lime text-[14px]">{formatTime(preference?.send_time ?? DEFAULT_TIMES[definition.type] ?? null)}</Text><Feather name="clock" size={15} color={colors.lime} /></View></Pressable> : null}</View>;
            })}
          </View>
        </>}

        {pickerType === 'morning_checkin' ? <ScrollView className="max-h-[220px] border-y border-border">{REMINDER_TIMES.map((time) => {
          return <Pressable key={time} accessibilityRole="button" onPress={() => { setPickerType(null); void saveTime('morning_checkin', timeToDate(time)); }} className="min-h-[44px] justify-center border-b border-border"><Text className="font-body text-white">{time.slice(0, 5)}</Text></Pressable>;
        })}</ScrollView> : pickerType ? <View className="border-y border-border py-md"><DateTimePicker value={pickerValue} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} themeVariant="dark" onChange={onPickerChange} />{Platform.OS === 'ios' ? <Pressable onPress={() => { const type = pickerType; setPickerType(null); void saveTime(type, pickerValue); }} className="min-h-[44px] items-center justify-center border-y border-lime/30"><Text className="font-heading-bold text-lime text-[11px] uppercase">Done</Text></Pressable> : null}</View> : null}
        {!isOffline && message ? <Text accessibilityRole="alert" className="font-body text-tertiary-text text-[14px]">{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingToggleRow({ title, description, value, disabled, onChange }: { title: string; description: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <View className="min-h-[68px] flex-row items-center gap-md border-b border-border py-sm"><View className="flex-1"><Text className="font-heading-bold text-white text-[13px] uppercase">{title}</Text><Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">{description}</Text></View><NotificationSwitch value={value} onChange={onChange} disabled={disabled} /></View>;
}

function NotificationSwitch({ value, disabled, onChange }: { value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{
        width: 51,
        height: 31,
        padding: 2,
        borderRadius: 16,
        backgroundColor: value ? colors.lime : '#252525',
        alignItems: value ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: value ? colors.dark : '#8A8A8A',
        }}
      />
    </Pressable>
  );
}

function timeToDate(value: string) { const match = /^(\d{2}):(\d{2})/.exec(value); const date = new Date(); date.setHours(Number(match?.[1] ?? 12), Number(match?.[2] ?? 0), 0, 0); return date; }
function dateToPgTime(value: Date) { return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:00`; }
function formatTime(value: string | null) { const match = value ? /^(\d{2}):(\d{2})/.exec(value) : null; return match ? `${match[1]}:${match[2]}` : 'Not set'; }
