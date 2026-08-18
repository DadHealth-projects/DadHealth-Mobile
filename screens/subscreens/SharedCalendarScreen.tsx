import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Schedule = { id: string; user_id: string; custody_dates: string[] | null; co_parent_user_id: string | null };
type SharedEvent = { id: string; schedule_id: string; event_date: string; event_type: 'handover' | 'school' | 'custody'; notes: string | null };
type SharedMilestone = { id: string; date: string; text: string; tag: string | null };
const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');

export default function SharedCalendarScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'SharedCalendar'>>();
  const { user, session } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [sharedSchedule, setSharedSchedule] = useState<Schedule | null>(null);
  const [events, setEvents] = useState<SharedEvent[]>([]);
  const [milestones, setMilestones] = useState<SharedMilestone[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [eventType, setEventType] = useState<'handover' | 'school'>('handover');
  const [eventNotes, setEventNotes] = useState('');
  const [showCustodyCalendar, setShowCustodyCalendar] = useState(false);
  const [showEventCalendar, setShowEventCalendar] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true); setError(null);
    const [ownedResult, sharedResult] = await Promise.all([
      supabase.from('co_parenting_schedules').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('co_parenting_schedules').select('*').eq('co_parent_user_id', user.id).maybeSingle(),
    ]);
    if (ownedResult.error || sharedResult.error) { setError('We could not load the co-parenting calendar. Please try again.'); setLoading(false); return; }
    const owned = ownedResult.data as Schedule | null;
    const shared = sharedResult.data as Schedule | null;
    setSchedule(owned); setSharedSchedule(shared);
    const activeSchedule = owned ?? shared;
    if (!activeSchedule) { setEvents([]); setMilestones([]); setLoading(false); return; }
    const queries: PromiseLike<{ data: unknown; error: unknown }>[] = [supabase.from('co_parenting_events').select('*').eq('schedule_id', activeSchedule.id).order('event_date', { ascending: true })];
    if (!owned && shared) queries.push(supabase.from('milestones').select('id,date,text,tag').eq('user_id', shared.user_id).gte('date', today()).order('date', { ascending: true }));
    const [eventResult, milestoneResult] = await Promise.all(queries);
    if (eventResult.error || milestoneResult?.error) setError('We could not load the co-parenting calendar details. Please try again.');
    else { setEvents((eventResult.data ?? []) as SharedEvent[]); setMilestones((milestoneResult?.data ?? []) as SharedMilestone[]); }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const acceptInvite = useCallback(async (token: string) => {
    if (!session?.access_token) { setMessage('Log in with the invited email to accept this calendar.'); return; }
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`${WEB_URL}/api/co-parenting/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ token }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to accept invite.');
      setMessage("You're connected to the co-parenting calendar."); await load();
    } catch { setMessage("This calendar invite could not be accepted. Check that you're signed in with the invited email, then try again."); }
    finally { setSaving(false); }
  }, [load, session?.access_token]);

  useEffect(() => { if (route.params?.token) void acceptInvite(route.params.token); }, [acceptInvite, route.params?.token]);

  const ensureSchedule = useCallback(async () => {
    if (schedule) return schedule.id;
    if (!user?.id) throw new Error('auth');
    const { data, error: createError } = await supabase.from('co_parenting_schedules').insert({ user_id: user.id }).select('id').single();
    if (createError) throw createError;
    return data.id as string;
  }, [schedule, user?.id]);

  const toggleCustodyDate = useCallback(async (dateString: string) => {
    if (sharedSchedule && !schedule) return;
    setSaving(true); setMessage(null);
    try {
      const current = schedule?.custody_dates ?? [];
      const next = current.includes(dateString) ? current.filter((item) => item !== dateString) : [...current, dateString].sort();
      if (schedule) {
        const { error: updateError } = await supabase.from('co_parenting_schedules').update({ custody_dates: next }).eq('id', schedule.id).eq('user_id', user?.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('co_parenting_schedules').insert({ user_id: user?.id, custody_dates: next });
        if (insertError) throw insertError;
      }
      await load();
    } catch { setMessage('We could not save your custody days. Please try again.'); }
    finally { setSaving(false); }
  }, [load, schedule, sharedSchedule, user?.id]);

  const addEvent = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true); setEventMessage(null);
    try {
      const scheduleId = await ensureSchedule();
      const { error: addError } = await supabase.from('co_parenting_events').insert({ schedule_id: scheduleId, event_date: localDate(eventDate), event_type: eventType, notes: eventNotes.trim() || null });
      if (addError) throw addError;
      setEventNotes(''); setEventMessage('Event added.'); await load();
    } catch { setEventMessage('We could not add this event. Please try again.'); }
    finally { setSaving(false); }
  }, [ensureSchedule, eventDate, eventNotes, eventType, load, user?.id]);

  const removeEvent = useCallback((eventId: string) => Alert.alert('Remove event?', 'This event will be removed from the co-parenting calendar.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void (async () => { const { error: removeError } = await supabase.from('co_parenting_events').delete().eq('id', eventId); if (removeError) setMessage('We could not remove this event.'); else await load(); })() }]), [load]);

  const sendInvite = useCallback(async () => {
    if (!session?.access_token || !inviteEmail.trim()) return;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`${WEB_URL}/api/co-parenting/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ email: inviteEmail.trim() }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to send invite.');
      setInviteEmail(''); setMessage('Invite sent.'); await load();
    } catch { setMessage('The co-parent invite was not sent. Check the email address, then try again.'); }
    finally { setSaving(false); }
  }, [inviteEmail, load, session?.access_token]);

  const revoke = useCallback(() => Alert.alert('Revoke access?', 'Your co-parent will immediately lose access to the shared calendar.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: () => void (async () => { if (!user?.id) return; setSaving(true); const [scheduleResult, profileResult] = await Promise.all([supabase.from('co_parenting_schedules').update({ co_parent_user_id: null }).eq('user_id', user.id), supabase.from('user_profile').update({ co_parent_id: null }).eq('user_id', user.id)]); setSaving(false); if (scheduleResult.error || profileResult.error) setMessage('We could not revoke access. Please try again.'); else { setMessage('Co-parent access revoked.'); await load(); } })() }]), [load, user?.id]);

  const readOnly = Boolean(sharedSchedule && !schedule);
  const activeSchedule = schedule ?? sharedSchedule;
  const markedDates = useMemo(() => Object.fromEntries((activeSchedule?.custody_dates ?? []).map((date) => [date, { selected: true, selectedColor: colors.lime, selectedTextColor: colors.dark }])), [activeSchedule?.custody_dates]);

  return <SafeAreaView edges={['top']} className="flex-1 bg-dark"><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerClassName="px-lg pt-lg pb-xl gap-xl"><AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center" accessibilityLabel="Close co-parenting calendar"><Feather name="x" size={20} color={colors.text} /></Pressable>} /><ScreenHero eyebrow="Co-parenting calendar" headline={'Parenting,\ntogether'} sub={readOnly ? 'Your read-only view of custody days and shared events.' : 'Mark custody days and keep handovers and school events in one place.'} />
    {!user ? <LimeButton label="Log in to continue" onPress={() => navigation.navigate('Login')} /> : loading ? <View className="h-[360px] bg-white/5 rounded-button" /> : error ? <View className="gap-md"><Text className="font-body text-red-300">{error}</Text><LimeButton label="Try again" onPress={() => void load()} /></View> : <View className="gap-xl">{message ? <Text accessibilityRole="alert" className="font-body text-tertiary-text text-[13px]">{message}</Text> : null}<Text className="font-body text-muted-text text-[12px] leading-[18px]">{readOnly ? 'Mood, journal, score and community activity are never shared.' : 'A co-parent receives read-only access. Your mood, sleep, journal, Dad Score and community activity stay private.'}</Text><View className="gap-sm"><Pressable onPress={() => setShowCustodyCalendar((visible) => !visible)} accessibilityRole="button" accessibilityState={{ expanded: showCustodyCalendar }} accessibilityLabel={showCustodyCalendar ? 'Close custody calendar' : 'Open custody calendar'} className="min-h-[48px] flex-row items-center justify-between border-y border-border py-sm"><View><Text className="font-heading-bold text-white text-[13px] uppercase">Custody dates</Text><Text className="font-body text-tertiary-text text-[11px] mt-xs">{activeSchedule?.custody_dates?.length ?? 0} selected</Text></View><Feather name="calendar" size={18} color={colors.lime} /></Pressable>{showCustodyCalendar ? <Calendar current={today()} markedDates={markedDates} onDayPress={(day) => void toggleCustodyDate(day.dateString)} disableAllTouchEventsForDisabledDays theme={{ calendarBackground: colors.card, monthTextColor: colors.text, dayTextColor: colors.text, textDisabledColor: colors.tertiaryText, arrowColor: colors.lime, todayTextColor: colors.lime, selectedDayTextColor: colors.dark, textMonthFontFamily: 'BarlowCondensed-Bold', textDayFontFamily: 'Barlow-Regular' }} /> : null}</View>{saving ? <View className="h-[2px] bg-lime" /> : null}
      {!readOnly ? <><View className="gap-md"><Text className="font-heading-bold text-lime text-[11px] uppercase">Co-parent</Text>{schedule?.co_parent_user_id ? <View className="gap-md border-y border-lime/25 py-md"><Text className="font-body text-tertiary-text text-[13px]">A co-parent is connected with read-only access.</Text><Pressable onPress={revoke}><Text className="font-heading-bold text-red-300 text-[11px] uppercase">Revoke access</Text></Pressable></View> : <View className="gap-md"><TextInput value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" placeholder="co-parent@example.com" placeholderTextColor={colors.tertiaryText} className="min-h-[48px] border-b border-border font-body text-white" /><LimeButton label="Send invite" onPress={() => void sendInvite()} loading={saving} disabled={!inviteEmail.trim()} /></View>}</View><View className="gap-md"><Text className="font-heading-bold text-lime text-[11px] uppercase">Handover & school events</Text><Pressable onPress={() => setShowEventCalendar((visible) => !visible)} accessibilityRole="button" accessibilityState={{ expanded: showEventCalendar }} accessibilityLabel={showEventCalendar ? 'Close event calendar' : 'Open event calendar'} className="min-h-[48px] flex-row items-center justify-between border-y border-border py-sm"><View><Text className="font-heading-bold text-white text-[13px] uppercase">Event date</Text><Text className="font-body text-tertiary-text text-[11px] mt-xs">{eventDate.toLocaleDateString('en-GB')}</Text></View><Feather name="calendar" size={18} color={colors.lime} /></Pressable>{showEventCalendar ? <Calendar current={localDate(eventDate)} markedDates={{ [localDate(eventDate)]: { selected: true, selectedColor: colors.lime, selectedTextColor: colors.dark } }} onDayPress={(day) => { setEventDate(new Date(`${day.dateString}T12:00:00`)); setShowEventCalendar(false); }} theme={{ calendarBackground: colors.card, monthTextColor: colors.text, dayTextColor: colors.text, textDisabledColor: colors.tertiaryText, arrowColor: colors.lime, todayTextColor: colors.lime, selectedDayTextColor: colors.dark, textMonthFontFamily: 'BarlowCondensed-Bold', textDayFontFamily: 'Barlow-Regular' }} /> : null}<View className="flex-row gap-md"><TypeOption label="Handover" selected={eventType === 'handover'} onPress={() => setEventType('handover')} /><TypeOption label="School event" selected={eventType === 'school'} onPress={() => setEventType('school')} /></View><TextInput value={eventNotes} onChangeText={setEventNotes} placeholder="Notes visible to both parents" placeholderTextColor={colors.tertiaryText} multiline className="min-h-[88px] rounded-button border border-border bg-card p-md font-body text-white" /><LimeButton label="Add event" onPress={() => void addEvent()} loading={saving} />{eventMessage ? <Text accessibilityRole="alert" className="font-body text-tertiary-text text-[12px]">{eventMessage}</Text> : null}</View></> : null}
      <View className="gap-sm"><Text className="font-heading-bold text-lime text-[11px] uppercase">Handover & school events</Text>{events.length === 0 ? <Text className="font-body text-muted-text">No events yet.</Text> : events.map((event) => <View key={event.id} className="flex-row gap-md border-b border-border py-md"><View className="bg-lime px-sm py-xs self-start"><Text className="font-heading-bold text-dark text-[10px] uppercase">{shortDate(event.event_date)}</Text></View><View className="flex-1"><Text className="font-heading-bold text-white text-[12px] uppercase">{event.event_type}</Text>{event.notes ? <Text className="font-body text-tertiary-text text-[13px] mt-xs">{event.notes}</Text> : null}</View>{!readOnly ? <Pressable onPress={() => removeEvent(event.id)} accessibilityLabel="Remove event"><Feather name="trash-2" size={17} color="#FCA5A5" /></Pressable> : null}</View>)}</View>{readOnly ? <View className="gap-sm"><Text className="font-heading-bold text-lime text-[11px] uppercase">Upcoming milestones</Text>{milestones.length === 0 ? <Text className="font-body text-muted-text">No upcoming milestones.</Text> : milestones.map((milestone) => <View key={milestone.id} className="border-b border-border py-md"><Text className="font-heading-bold text-white text-[12px] uppercase">{shortDate(milestone.date)} · {milestone.tag}</Text><Text className="font-body text-tertiary-text text-[13px] mt-xs">{milestone.text}</Text></View>)}</View> : null}</View>}
  </ScrollView></SafeAreaView>;
}

function TypeOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} className={`flex-1 min-h-[44px] items-center justify-center border-b ${selected ? 'border-lime' : 'border-border'}`}><Text className={`font-heading-bold text-[11px] uppercase ${selected ? 'text-lime' : 'text-muted-text'}`}>{label}</Text></Pressable>; }
function today() { const date = new Date(); return localDate(date); }
function localDate(date: Date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); }
function shortDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
