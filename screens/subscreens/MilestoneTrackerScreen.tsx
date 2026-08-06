import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { trackEvent } from '../../lib/analytics';
import { isProfilePro } from '../../lib/proStatus';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Milestone = { id: string; date: string; text: string; tag: string; photo_url: string | null };
type PreparedPhoto = { uri: string; name: string; type: string };

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');
const STORAGE_LIMIT = 500 * 1024 * 1024;
const STORAGE_WARNING = 450 * 1024 * 1024;

export default function MilestoneTrackerScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user, session } = useAuth();
  const { refresh: refreshDashboard } = useDashboard(user?.id);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(Boolean(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('moment');
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoTarget, setPhotoTarget] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [storageBytes, setStorageBytes] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true); setError(null);
    const [profileResult, milestoneResult, storageResult] = await Promise.all([
      supabase.from('user_profile').select('is_pro,subscription_status').eq('user_id', user.id).maybeSingle(),
      supabase.from('milestones').select('id,date,text,tag,photo_url').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.storage.from('milestone-photos').list(user.id, { limit: 1000 }),
    ]);
    if (profileResult.error) setError('We could not confirm your Dad Health Pro access. Please try again.');
    else if (milestoneResult.error) setError('We could not load your milestones. Please try again.');
    else {
      setIsPro(isProfilePro(profileResult.data));
      setMilestones((milestoneResult.data ?? []) as Milestone[]);
      setStorageBytes((storageResult.data ?? []).reduce((sum, item) => sum + (Number(item.metadata?.size) || 0), 0));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const uploadPhoto = useCallback(async (milestoneId: string, selected: PreparedPhoto) => {
    if (!session?.access_token) throw new Error('auth_required');
    setPhotoTarget(milestoneId); setError(null);
    try {
      const form = new FormData();
      form.append('photo', selected as unknown as Blob);
      const response = await fetch(`${WEB_URL}/api/milestones/${milestoneId}/photo`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      if (!response.ok) throw new Error('upload_failed');
      trackEvent('milestone_photo_uploaded', { milestone_id: milestoneId }, user?.id);
      await refresh(); await refreshDashboard();
    } catch { setError('We could not save the milestone photo. Please try again.'); }
    finally { setPhotoTarget(null); }
  }, [refresh, refreshDashboard, session?.access_token, user?.id]);

  const pickPhoto = useCallback(async (target?: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo access is required to choose a milestone photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const largest = Math.max(asset.width, asset.height);
      const resize = largest > 1600
        ? (asset.width >= asset.height ? { width: 1600 } : { height: 1600 })
        : undefined;
      const prepared = await ImageManipulator.manipulateAsync(asset.uri, resize ? [{ resize }] : [], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
      const nextPhoto = { uri: prepared.uri, name: 'milestone.jpg', type: 'image/jpeg' };
      if (target) await uploadPhoto(target, nextPhoto);
      else setPhoto(nextPhoto);
    } catch { setError('We could not prepare that photo. Try another image.'); }
  }, [uploadPhoto]);

  const saveMilestone = useCallback(async () => {
    const text = note.trim();
    if (!user?.id || !text) { setError('Add a short milestone note first.'); return; }
    setSaving(true); setError(null);
    const values = { date: date.toISOString().slice(0, 10), text, tag: tag.trim() || 'moment' };
    const saveResult = editingId
      ? await supabase.from('milestones').update(values).eq('id', editingId).eq('user_id', user.id).select('id').single()
      : await supabase.from('milestones').insert({ user_id: user.id, ...values }).select('id').single();
    if (saveResult.error) setError('We could not save this milestone. Please try again.');
    else {
      trackEvent(editingId ? 'milestone_updated' : 'milestone_logged', { tag: tag.trim() || 'moment', date: date.toISOString().slice(0, 10), text_length: text.length }, user.id);
      if (photo) await uploadPhoto(saveResult.data.id, photo);
      setNote(''); setTag('moment'); setPhoto(null); setEditingId(null); setDate(new Date());
      await refresh(); await refreshDashboard();
    }
    setSaving(false);
  }, [date, editingId, note, photo, refresh, refreshDashboard, tag, uploadPhoto, user?.id]);

  const editMilestone = useCallback((milestone: Milestone) => {
    setEditingId(milestone.id);
    setDate(new Date(`${milestone.date}T12:00:00`));
    setNote(milestone.text);
    setTag(milestone.tag);
    setPhoto(null);
    setError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDate(new Date());
    setNote('');
    setTag('moment');
    setPhoto(null);
  }, []);

  const deleteMilestone = useCallback((milestone: Milestone) => {
    Alert.alert('Delete milestone?', 'This milestone and its photo will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (!user?.id) return;
        setPhotoTarget(milestone.id);
        setError(null);
        void (async () => {
          try {
            if (milestone.photo_url && session?.access_token) {
              const photoResponse = await fetch(`${WEB_URL}/api/milestones/${milestone.id}/photo`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
              if (!photoResponse.ok) throw new Error('photo_delete_failed');
            }
            const { error: deleteError } = await supabase.from('milestones').delete().eq('id', milestone.id).eq('user_id', user.id);
            if (deleteError) throw deleteError;
            if (editingId === milestone.id) cancelEdit();
            trackEvent('milestone_deleted', { milestone_id: milestone.id }, user.id);
            await refresh();
            await refreshDashboard();
          } catch {
            setError('We could not delete this milestone. Please try again.');
          } finally {
            setPhotoTarget(null);
          }
        })();
      } },
    ]);
  }, [cancelEdit, editingId, refresh, refreshDashboard, session?.access_token, user?.id]);

  const removePhoto = useCallback((milestone: Milestone) => {
    Alert.alert('Remove photo?', 'The milestone will remain in your history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => {
      if (!session?.access_token) return;
      setPhotoTarget(milestone.id);
      void fetch(`${WEB_URL}/api/milestones/${milestone.id}/photo`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((response) => { if (!response.ok) throw new Error('remove_failed'); return refresh(); })
        .then(() => refreshDashboard())
        .catch(() => setError('We could not remove the milestone photo. Please try again.'))
        .finally(() => setPhotoTarget(null));
    } }]);
  }, [refresh, refreshDashboard, session?.access_token]);

  const nearLimit = storageBytes >= STORAGE_WARNING;
  const dateLabel = useMemo(() => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), [date]);

  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="px-lg pt-lg pb-xl gap-xl"><AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close milestone tracker" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>} /><ScreenHero eyebrow="Milestone tracker" headline={'Moments worth\nremembering'} sub="Log the moments that matter." />
    {!user ? <LimeButton label="Log in to continue" onPress={() => navigation.navigate('Login')} /> : loading ? <View className="gap-sm">{[0,1,2].map((item) => <View key={item} className="h-[100px] rounded-button bg-white/5" />)}</View> : error && milestones.length === 0 ? <View accessibilityRole="alert" className="gap-md rounded-button border border-red-400/40 bg-red-400/10 p-md"><Text className="font-body text-red-300 text-[13px]">{error}</Text><LimeButton label="Try again" onPress={() => void refresh()} /></View> : !isPro ? <View className="gap-md border-y border-border py-xl"><Feather name="lock" size={24} color={colors.lime} /><Text className="font-heading-bold text-white text-[18px] uppercase">Dad Health Pro</Text><Text className="font-body text-white/50 text-[13px]">Words are good. Photos last forever.</Text><LimeButton label="View Dad Health Pro" onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} /></View> : <View className="gap-xl">
      <View className="gap-md"><Pressable onPress={() => setShowDatePicker((visible) => !visible)} accessibilityRole="button" accessibilityState={{ expanded: showDatePicker }} accessibilityLabel={showDatePicker ? 'Close milestone date picker' : 'Choose milestone date'} className="min-h-[48px] flex-row items-center justify-between border-y border-border py-sm"><Text className="font-heading-bold text-white text-[13px] uppercase">{dateLabel}</Text><Feather name="calendar" size={18} color={colors.lime} /></Pressable>{showDatePicker ? <View className="gap-sm"><DateTimePicker value={date} maximumDate={new Date()} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_event: DateTimePickerEvent, value?: Date) => { if (Platform.OS !== 'ios') setShowDatePicker(false); if (value) setDate(value); }} />{Platform.OS === 'ios' ? <Pressable onPress={() => setShowDatePicker(false)} accessibilityRole="button" className="min-h-[44px] items-center justify-center border-y border-lime/30"><Text className="font-heading-bold text-lime text-[12px] uppercase">Done</Text></Pressable> : null}</View> : null}<TextInput value={note} onChangeText={setNote} placeholder="First bike ride, school play, big laugh..." placeholderTextColor={colors.tertiaryText} multiline textAlignVertical="top" className="min-h-[120px] rounded-button border border-border bg-card p-md font-body text-white text-[14px]" /><TextInput value={tag} onChangeText={setTag} placeholder="Tag" placeholderTextColor={colors.tertiaryText} className="min-h-[48px] rounded-button border border-border bg-card px-md font-body text-white" />
        {photo ? <View className="relative"><Image source={{ uri: photo.uri }} className="h-[180px] w-full rounded-button" resizeMode="cover" /><Pressable onPress={() => setPhoto(null)} accessibilityLabel="Remove selected photo" className="absolute top-sm right-sm h-[36px] w-[36px] rounded-full bg-dark/90 items-center justify-center"><Feather name="x" size={18} color={colors.text} /></Pressable></View> : null}
        {editingId ? <View className="flex-row items-center justify-between"><Text className="font-heading-bold text-lime text-[11px] uppercase">Editing milestone</Text><Pressable onPress={cancelEdit} accessibilityRole="button"><Text className="font-heading-bold text-white/55 text-[11px] uppercase">Cancel</Text></Pressable></View> : null}
        <View className="flex-row gap-sm"><Pressable onPress={() => void pickPhoto()} className="flex-1 min-h-[48px] flex-row gap-sm border border-white/20 rounded-button items-center justify-center"><Feather name="image" size={16} color={colors.lime} /><Text className="font-heading-bold text-white text-[11px] uppercase">{photo ? 'Change photo' : 'Add photo'}</Text></Pressable><View className="flex-1"><LimeButton label={editingId ? 'Update milestone' : 'Save milestone'} onPress={() => void saveMilestone()} loading={saving} disabled={!note.trim()} /></View></View>
      </View>
      {error ? <View accessibilityRole="alert" className="rounded-button border border-red-400/40 bg-red-400/10 p-md"><Text className="font-body text-red-300 text-[13px]">{error}</Text></View> : null}
      {nearLimit ? <View className="border border-lime/30 bg-lime/10 p-md"><Text className="font-body text-white/60 text-[12px]">Photo storage: {formatStorage(storageBytes)} of {formatStorage(STORAGE_LIMIT)}.</Text></View> : null}
      <View className="gap-sm"><Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Your milestones</Text>{milestones.length === 0 ? <Text className="font-body text-white/45 text-[13px]">No milestones yet.</Text> : milestones.map((milestone) => <View key={milestone.id} className="border-b border-border py-md gap-sm">{milestone.photo_url ? <Pressable onPress={() => setSelectedPhoto(milestone.photo_url)}><Image source={{ uri: milestone.photo_url }} className="h-[170px] w-full rounded-button" resizeMode="cover" /></Pressable> : null}<View className="flex-row gap-md"><View className="rounded-[4px] bg-lime px-sm py-xs self-start"><Text className="font-heading-bold text-dark text-[10px] uppercase">{formatMilestoneDate(milestone.date)}</Text></View><View className="flex-1"><Text className="font-body text-white/70 text-[14px] leading-[20px]">{milestone.text}</Text><Text className="font-heading-bold text-white/35 text-[10px] uppercase mt-xs">{milestone.tag}</Text></View></View><View className="flex-row flex-wrap gap-md"><Pressable onPress={() => setSelectedMilestone(milestone)}><Text className="font-heading-bold text-lime text-[11px] uppercase">View</Text></Pressable><Pressable onPress={() => editMilestone(milestone)} disabled={photoTarget === milestone.id}><Text className="font-heading-bold text-lime text-[11px] uppercase">Edit</Text></Pressable><Pressable onPress={() => deleteMilestone(milestone)} disabled={photoTarget === milestone.id}><Text className="font-heading-bold text-red-300 text-[11px] uppercase">Delete</Text></Pressable><Pressable onPress={() => void pickPhoto(milestone.id)} disabled={photoTarget === milestone.id}><Text className="font-heading-bold text-lime text-[11px] uppercase">{milestone.photo_url ? 'Replace photo' : 'Add photo'}</Text></Pressable>{milestone.photo_url ? <Pressable onPress={() => removePhoto(milestone)} disabled={photoTarget === milestone.id}><Text className="font-heading-bold text-red-300 text-[11px] uppercase">Remove photo</Text></Pressable> : null}</View></View>)}</View>
    </View>}
  </ScrollView><Modal visible={Boolean(selectedMilestone)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedMilestone(null)}><SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-dark"><ScrollView contentContainerClassName="px-lg py-lg gap-xl"><View className="flex-row items-center justify-between"><Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Milestone memory</Text><Pressable onPress={() => setSelectedMilestone(null)} accessibilityRole="button" accessibilityLabel="Close memory" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable></View>{selectedMilestone?.photo_url ? <Image source={{ uri: selectedMilestone.photo_url }} className="h-[320px] w-full rounded-button" resizeMode="cover" /> : <View className="h-[180px] items-center justify-center border-y border-border"><Feather name="heart" size={30} color={colors.lime} /></View>}<View className="gap-md"><View className="flex-row items-center gap-sm"><Text className="font-heading-bold text-lime text-[12px] uppercase">{selectedMilestone ? formatMilestoneDate(selectedMilestone.date) : ''}</Text><Text className="font-heading-bold text-white/35 text-[11px] uppercase">{selectedMilestone?.tag}</Text></View><Text className="font-body text-white text-[20px] leading-[30px]">{selectedMilestone?.text}</Text></View></ScrollView></SafeAreaView></Modal><Modal visible={Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}><Pressable onPress={() => setSelectedPhoto(null)} className="flex-1 bg-black/95 items-center justify-center p-lg"><Image source={{ uri: selectedPhoto ?? '' }} className="w-full h-[70%]" resizeMode="contain" /><View className="absolute top-xl right-lg h-[44px] w-[44px] rounded-full bg-white/10 items-center justify-center"><Feather name="x" size={22} color={colors.text} /></View></Pressable></Modal></SafeAreaView>;
}

function formatStorage(bytes: number) { return `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`; }
function formatMilestoneDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
