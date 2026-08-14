import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationSettings, type NotificationType } from '../../hooks/useNotificationSettings';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';
import { requestPushPermission } from '../../lib/pushNotifications';

const TYPES: Array<{ type: NotificationType; title: string; description: string; linkLabel: string; needsTime?: boolean; timeHint?: string }> = [
  { type: 'morning_checkin', title: 'Morning check-in', description: '07:30 daily - Good morning. How are you feeling today?', linkLabel: 'Home' },
  { type: 'bedtime_story', title: 'Bedtime story reminder', description: '30 minutes before your set bedtime - Bedtime in 30 minutes. Story time?', linkLabel: 'Bond', needsTime: true, timeHint: 'Bedtime' },
  { type: 'workout_window', title: 'Workout window', description: 'At your set time - Your workout window is now. 20 minutes is enough.', linkLabel: 'Fitness', needsTime: true, timeHint: 'Workout time' },
  { type: 'weekly_score', title: 'Weekly report ready', description: 'Monday 08:00 - Your Dad Health Score this week: [score]', linkLabel: 'Progress' },
  { type: 'streak_at_risk', title: 'Streak at risk', description: '21:00 if you have not checked in - Your [n]-day streak ends at midnight.', linkLabel: 'Home' },
  { type: 'weekly_challenge', title: 'Weekly challenge', description: 'Monday 08:00 - Weekly challenge title + description', linkLabel: 'Home' },
  { type: 'journal_prompt', title: 'Journal prompt', description: 'At your set evening time - rotating prompt', linkLabel: 'Mind', needsTime: true, timeHint: 'Evening time' },
  { type: 'milestone_anniversary', title: 'Milestone anniversary', description: 'Date-matched - One year ago: [milestone text]', linkLabel: 'Bond' },
  { type: 'community_reply', title: 'Community replies', description: 'When someone replies to your community post or comment.', linkLabel: 'Squad' },
  { type: 'co_parent_event_added', title: 'Co-parent events', description: 'When a co-parent adds an event to your shared calendar.', linkLabel: 'Bond' },
  { type: 'present_dad_mode_complete', title: 'Present Dad Mode complete', description: 'After you complete a full 60-minute session.', linkLabel: 'Bond' },
];

const DEFAULT_TIMES: Partial<Record<NotificationType, string>> = { bedtime_story: '20:00:00', workout_window: '12:00:00', journal_prompt: '20:30:00' };

export default function NotificationSettingsScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const settings = useNotificationSettings(user?.id);
  const deviceTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerType, setPickerType] = useState<NotificationType | null>(null);
  const [pickerValue, setPickerValue] = useState(new Date());

  const preferenceFor = useCallback((type: NotificationType) => settings.preferences.find((preference) => preference.notification_type === type), [settings.preferences]);

  const toggleMaster = useCallback(async (enabled: boolean) => {
    setMessage(null);
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
    const updateError = await settings.updateMaster(enabled, deviceTimezone);
    if (updateError) setMessage(updateError);
    else if (!enabled) setMessage('Push notifications disabled.');
    else if (!permissionConfigured) setMessage('Preferences saved. Device notifications will activate after the app is rebuilt.');
    else if (!permissionGranted) setMessage('Notifications are enabled, but device permission was not granted.');
    else setMessage('Push notifications enabled.');
  }, [deviceTimezone, settings.updateMaster]);

  const togglePreference = useCallback(async (type: NotificationType, enabled: boolean) => {
    setMessage(null);
    const existing = preferenceFor(type);
    const definition = TYPES.find((item) => item.type === type);
    const sendTime = enabled && definition?.needsTime && !existing?.send_time ? DEFAULT_TIMES[type] ?? null : existing?.send_time ?? null;
    const updateError = await settings.upsertPreference(type, enabled, sendTime);
    if (updateError) setMessage(updateError);
  }, [preferenceFor, settings.upsertPreference]);

  const openTimePicker = useCallback((type: NotificationType) => {
    const value = timeToDate(preferenceFor(type)?.send_time ?? DEFAULT_TIMES[type] ?? '12:00:00');
    setPickerValue(value);
    setPickerType(type);
  }, [preferenceFor]);

  const saveTime = useCallback(async (type: NotificationType, value: Date) => {
    setMessage(null);
    const updateError = await settings.upsertPreference(type, preferenceFor(type)?.enabled ?? true, dateToPgTime(value));
    if (updateError) setMessage(updateError);
    else setMessage('Notification time saved.');
  }, [preferenceFor, settings.upsertPreference]);

  const onPickerChange = useCallback((event: DateTimePickerEvent, value?: Date) => {
    if (event.type === 'dismissed') { setPickerType(null); return; }
    if (!value || !pickerType) return;
    setPickerValue(value);
    if (Platform.OS !== 'ios') { const type = pickerType; setPickerType(null); void saveTime(type, value); }
  }, [pickerType, saveTime]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close push notifications" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="Settings" headline={'Push\nnotifications'} sub="All notifications are opt-in. Times are based on your dad timezone." />

        {!user ? <Pressable onPress={() => navigation.navigate('Login')} className="min-h-[48px] justify-center border-y border-border"><Text className="font-heading-bold text-lime text-[12px] uppercase">Log in to edit settings</Text></Pressable> : settings.loading ? <View className="gap-sm">{[0,1,2,3].map((item) => <View key={item} className="h-[72px] bg-white/5" />)}</View> : settings.error ? <View className="gap-sm border-y border-red-400/30 py-lg"><Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{settings.error}</Text><Pressable onPress={() => void settings.refresh()}><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable></View> : <>
          <View className="border-t border-border">
            <SettingToggleRow title="Enable push notifications" description="Required for all notification types." value={settings.masterEnabled} disabled={settings.savingKey === 'master'} onChange={(value) => void toggleMaster(value)} />
            <View className="min-h-[62px] flex-row items-center gap-md border-b border-border py-sm"><View className="flex-1"><Text className="font-heading-bold text-white text-[13px] uppercase">Timezone</Text><Text className="font-body text-tertiary-text text-[11px] mt-xs">{settings.timezone || 'Not set'}</Text></View><Pressable onPress={() => void settings.saveTimezone(deviceTimezone).then(setMessage)} disabled={settings.savingKey === 'timezone'} className="min-h-[40px] justify-center border-b border-lime"><Text className="font-heading-bold text-lime text-[10px] uppercase">Use device timezone</Text></Pressable></View>
          </View>

          <View className="border-t border-border">
            {TYPES.map((definition) => {
              const preference = preferenceFor(definition.type);
              const disabled = !settings.masterEnabled || settings.savingKey === definition.type;
              return <View key={definition.type} className="border-b border-border py-md gap-sm"><View className="flex-row items-start gap-md"><View className="flex-1"><Text className="font-heading-bold text-white text-[13px] uppercase">{definition.title}</Text><Text className="font-body text-muted-text text-[11px] leading-[17px] mt-xs">{definition.description}</Text><Text className="font-heading-bold text-lime/60 text-[9px] uppercase mt-xs">Opens: {definition.linkLabel}</Text></View><Switch value={Boolean(preference?.enabled)} onValueChange={(value) => void togglePreference(definition.type, value)} disabled={disabled} trackColor={{ false: '#252525', true: colors.lime }} thumbColor={preference?.enabled ? colors.dark : '#8A8A8A'} /></View>{definition.needsTime ? <Pressable onPress={() => openTimePicker(definition.type)} disabled={disabled} className="min-h-[40px] flex-row items-center justify-between border-t border-border pt-sm"><Text className="font-heading-bold text-tertiary-text text-[10px] uppercase">{definition.timeHint}</Text><View className="flex-row items-center gap-sm"><Text className="font-heading-bold text-lime text-[11px]">{formatTime(preference?.send_time ?? DEFAULT_TIMES[definition.type] ?? null)}</Text><Feather name="clock" size={15} color={colors.lime} /></View></Pressable> : null}</View>;
            })}
          </View>
        </>}

        {pickerType ? <View className="border-y border-border py-md"><DateTimePicker value={pickerValue} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onPickerChange} />{Platform.OS === 'ios' ? <Pressable onPress={() => { const type = pickerType; setPickerType(null); void saveTime(type, pickerValue); }} className="min-h-[44px] items-center justify-center border-y border-lime/30"><Text className="font-heading-bold text-lime text-[11px] uppercase">Done</Text></Pressable> : null}</View> : null}
        {message ? <Text accessibilityRole="alert" className="font-body text-tertiary-text text-[12px]">{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingToggleRow({ title, description, value, disabled, onChange }: { title: string; description: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <View className="min-h-[68px] flex-row items-center gap-md border-b border-border py-sm"><View className="flex-1"><Text className="font-heading-bold text-white text-[13px] uppercase">{title}</Text><Text className="font-body text-muted-text text-[11px] mt-xs">{description}</Text></View><Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: '#252525', true: colors.lime }} thumbColor={value ? colors.dark : '#8A8A8A'} /></View>;
}

function timeToDate(value: string) { const match = /^(\d{2}):(\d{2})/.exec(value); const date = new Date(); date.setHours(Number(match?.[1] ?? 12), Number(match?.[2] ?? 0), 0, 0); return date; }
function dateToPgTime(value: Date) { return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:00`; }
function formatTime(value: string | null) { const match = value ? /^(\d{2}):(\d{2})/.exec(value) : null; return match ? `${match[1]}:${match[2]}` : 'Not set'; }
