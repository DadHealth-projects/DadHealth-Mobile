import React, { useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import MultilineTextInput from '../../components/MultilineTextInput';
import { useAuth } from '../../contexts/AuthContext';
import { refreshDashboardForUser } from '../../hooks/useDashboard';
import {
  createManualActivity,
  MANUAL_ACTIVITY_CATEGORIES,
  MANUAL_ACTIVITY_OPTIONS,
  notifyManualActivityChanged,
  dateKeyToPickerDate,
  getUtcDateKey,
  pickerDateToKey,
  shiftDateKey,
  type ManualActivityPillar,
} from '../../lib/manualActivities';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Category = string;
type ActivityOption = { value: string; label: string };

export default function ManualActivityLogScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'ManualActivityLog'>>();
  const { user } = useAuth();
  const pillar = route.params.pillar;
  const initialCategory = pillar === 'body' ? null : MANUAL_ACTIVITY_CATEGORIES[pillar][0].value;
  const [category, setCategory] = useState<Category | null>(initialCategory);
  const initialOptions = optionsFor(pillar, initialCategory);
  const [activityType, setActivityType] = useState(initialOptions[0]?.value ?? '');
  const [otherText, setOtherText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [intensity, setIntensity] = useState<'light' | 'moderate' | 'hard' | null>(null);
  const [contactDay, setContactDay] = useState(pillar === 'bond');
  const [notes, setNotes] = useState('');
  const [activityDate, setActivityDate] = useState(getUtcDateKey());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(Crypto.randomUUID()).current;
  const today = getUtcDateKey();
  const earliestDate = shiftDateKey(today, -7);
  const durationMinutes = durationText.trim() ? Number(durationText) : null;
  const options = useMemo(() => optionsFor(pillar, category), [category, pillar]);

  const selectCategory = (next: Category) => {
    const nextOptions = optionsFor(pillar, next);
    setCategory(next);
    setActivityType(nextOptions[0]?.value ?? '');
    if (next === 'remote') setContactDay(false);
    else if (pillar === 'bond') setContactDay(true);
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setDatePickerOpen(false);
    if (selected) setActivityDate(pickerDateToKey(selected));
  };

  const submit = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createManualActivity(user.id, requestId, {
        pillar,
        category,
        activityType,
        otherText,
        durationMinutes,
        intensity,
        contactDay: pillar === 'bond' ? contactDay : null,
        notes,
        activityDate,
      });
      notifyManualActivityChanged();
      await refreshDashboardForUser(user.id);
      navigation.goBack();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '';
      if (message.includes('activity_date_exceeds_backdate_limit')) {
        setError('Activities can be backdated up to 7 days. Choose a more recent date.');
      } else if (message.includes('activity_date_cannot_be_future')) {
        setError('Choose today or an earlier date.');
      } else if (message.includes('fetch') || message.includes('network') || message.includes('offline')) {
        setError('Connect to the internet to save this activity, then try again.');
      } else {
        setError(message || 'We could not save this activity. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const needsDuration = pillar !== 'bond';
  const minimumDuration = pillar === 'mind' ? 5 : 15;
  const showShortDurationNote = durationMinutes != null && Number.isFinite(durationMinutes) && durationMinutes < minimumDuration;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-xl gap-lg">
          <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
          <View className="gap-xs">
            <Text className="font-heading text-white text-[34px] uppercase">Log {pillar} activity</Text>
            <Text className="font-body text-muted-text text-[14px] leading-[20px]">Manual activity logging is free. Your activity date determines its score week.</Text>
          </View>

          {!user ? (
            <LimeButton label="Log in to save activity" onPress={() => navigation.navigate('Login')} />
          ) : (
            <>
              {pillar !== 'body' ? (
                <View className="gap-sm">
                  <Text className="font-heading-bold text-lime text-[11px] uppercase tracking-label">Category</Text>
                  <View className="flex-row flex-wrap gap-xs">
                    {MANUAL_ACTIVITY_CATEGORIES[pillar].map((item) => (
                      <ChoiceChip key={item.value} label={item.label} selected={category === item.value} onPress={() => selectCategory(item.value)} />
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="gap-sm">
                <Text className="font-heading-bold text-lime text-[11px] uppercase tracking-label">Activity</Text>
                <View className="flex-row flex-wrap gap-xs">
                  {options.map((item) => (
                    <ChoiceChip key={item.value} label={item.label} selected={activityType === item.value} onPress={() => setActivityType(item.value)} />
                  ))}
                </View>
              </View>

              {activityType === 'other' ? (
                <Field label="Describe the activity">
                <TextInput value={otherText} onChangeText={setOtherText} placeholder="Add a short description" placeholderTextColor={colors.mutedText} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} className="min-h-[48px] rounded-button border border-border bg-card px-md font-body text-white" />
                </Field>
              ) : null}

              <Field label={needsDuration ? 'Duration (minutes) · required' : 'Duration (minutes) · optional'}>
                <TextInput value={durationText} onChangeText={(value) => setDurationText(value.replace(/[^0-9]/g, ''))} placeholder={needsDuration ? 'e.g. 30' : 'Add duration if known'} placeholderTextColor={colors.mutedText} keyboardType="numbers-and-punctuation" returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} className="min-h-[48px] rounded-button border border-border bg-card px-md font-body text-white" />
              </Field>

              {pillar === 'body' ? (
                <View className="gap-sm">
                  <Text className="font-heading-bold text-lime text-[11px] uppercase tracking-label">Intensity · required</Text>
                  <View className="flex-row gap-sm">
                    {(['light', 'moderate', 'hard'] as const).map((value) => (
                      <ChoiceChip key={value} label={value} selected={intensity === value} onPress={() => setIntensity(value)} />
                    ))}
                  </View>
                </View>
              ) : null}

              {pillar === 'bond' ? (
                <View className="min-h-[48px] flex-row items-center justify-between border-b border-border">
                  <View className="flex-1 pr-md">
                    <Text className="font-body-semibold text-white text-[14px]">Contact day</Text>
                    <Text className="font-body text-muted-text text-[11px]">Context for your activity history</Text>
                  </View>
                  <Switch value={contactDay} onValueChange={setContactDay} disabled={category === 'remote'} trackColor={{ false: '#383A3D', true: `${colors.lime}88` }} thumbColor={contactDay ? colors.lime : '#A5A5A5'} accessibilityLabel="Contact day" />
                </View>
              ) : null}

              <Field label="Date">
                <Pressable onPress={() => setDatePickerOpen((open) => !open)} accessibilityRole="button" accessibilityLabel={`Activity date ${activityDate}`} className="min-h-[48px] flex-row items-center justify-between rounded-button border border-border bg-card px-md active:opacity-75">
                  <Text className="font-body text-white text-[14px]">{activityDate}{activityDate === today ? ' · Today' : ''}</Text>
                  <Feather name="calendar" size={17} color={colors.lime} />
                </Pressable>
                {datePickerOpen ? <View className="bg-card"><DateTimePicker value={dateKeyToPickerDate(activityDate)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} themeVariant="dark" minimumDate={dateKeyToPickerDate(earliestDate)} maximumDate={dateKeyToPickerDate(today)} onChange={onDateChange} /></View> : null}
              </Field>

              <Field label="Notes · optional">
                <MultilineTextInput value={notes} onChangeText={setNotes} placeholder="Anything you'd like to remember?" placeholderTextColor={colors.mutedText} textAlignVertical="top" className="min-h-[92px] rounded-button border border-border bg-card px-md py-sm font-body text-white" />
              </Field>

              {showShortDurationNote ? (
                <Text className="font-body text-muted-text text-[12px] leading-[18px]">
                  {pillar === 'mind' ? 'Activities under 5 minutes don’t contribute to your score.' : 'Activities under 15 minutes don’t contribute to your score.'}
                </Text>
              ) : null}
              {pillar === 'bond' && activityType === 'mini_partners' ? (
                <Pressable onPress={() => { void Linking.openURL('https://dadhealth.co.uk/minipartners'); }} accessibilityRole="link" className="self-start">
                  <Text className="font-body text-muted-text text-[11px] underline">Not a Mini Partners member? Find out more at dadhealth.co.uk/minipartners</Text>
                </Pressable>
              ) : null}

              <InlineFormError message={error} />
              <LimeButton label={saving ? 'Saving…' : 'Save activity'} onPress={() => void submit()} disabled={saving} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function optionsFor(pillar: ManualActivityPillar, category: Category | null): readonly ActivityOption[] {
  if (pillar === 'body') return MANUAL_ACTIVITY_OPTIONS.body;
  if (!category) return [];
  if (pillar === 'bond') return MANUAL_ACTIVITY_OPTIONS.bond[category as keyof typeof MANUAL_ACTIVITY_OPTIONS.bond];
  return MANUAL_ACTIVITY_OPTIONS.mind[category as keyof typeof MANUAL_ACTIVITY_OPTIONS.mind];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View className="gap-xs"><Text className="font-heading-bold text-lime text-[11px] uppercase tracking-label">{label}</Text>{children}</View>;
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} className={`min-h-[40px] justify-center rounded-full border px-md ${selected ? 'border-lime bg-lime/15' : 'border-border bg-card'} active:opacity-70`}>
      <Text className={`font-body-semibold text-[12px] capitalize ${selected ? 'text-lime' : 'text-muted-text'}`}>{label}</Text>
    </Pressable>
  );
}
