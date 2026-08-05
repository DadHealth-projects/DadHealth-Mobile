import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';

import AppTopBar from '../components/AppTopBar';
import LimeButton from '../components/LimeButton';
import ScreenHero from '../components/mockup/ScreenHero';
import TagPill from '../components/dashboard/TagPill';
import type { FitnessWorkout } from '../hooks/useFitnessLibrary';
import { useFitnessLibrary } from '../hooks/useFitnessLibrary';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

const CONFIGURED_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk';
const WEB_URL = CONFIGURED_WEB_URL
  .replace(/^https:\/\/dadhealth\.co\.uk(?=\/|$)/, 'https://www.dadhealth.co.uk')
  .replace(/\/$/, '');
const DURATIONS = [10, 20, 30, 45] as const;
const EQUIPMENT = [
  { value: 'none', label: 'None' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'full_gym', label: 'Full gym' },
] as const;
const FOCUS = [
  { value: 'full_body', label: 'Full body' },
  { value: 'upper', label: 'Upper body' },
  { value: 'lower', label: 'Lower body' },
  { value: 'core', label: 'Core' },
] as const;

export default function AIWorkoutScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'AIWorkout'>>();
  const { user, session } = useAuth();
  const library = useFitnessLibrary(user?.id, true);
  const [durationMins, setDurationMins] = useState<(typeof DURATIONS)[number]>(20);
  const [equipment, setEquipment] = useState<(typeof EQUIPMENT)[number]['value']>('none');
  const [focus, setFocus] = useState<(typeof FOCUS)[number]['value']>('full_body');
  const [generatedWorkout, setGeneratedWorkout] = useState<FitnessWorkout | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<'duration' | 'equipment' | 'focus' | null>(null);

  const displayedWorkout = useMemo(
    () => generatedWorkout
      ?? library.workouts.find((workout) => workout.id === route.params?.workoutId)
      ?? null,
    [generatedWorkout, library.workouts, route.params?.workoutId],
  );

  const close = useCallback(() => navigation.goBack(), [navigation]);
  const openLogin = useCallback(() => navigation.navigate('Login'), [navigation]);
  const openPro = useCallback(
    () => navigation.navigate('Tabs', { screen: 'Home' }),
    [navigation],
  );
  const openWorkout = useCallback(() => {
    if (displayedWorkout) {
      navigation.navigate('ActiveWorkout', { workoutId: displayedWorkout.id });
    }
  }, [displayedWorkout, navigation]);

  const generate = useCallback(async () => {
    setError(null);
    if (!session?.access_token) {
      openLogin();
      return;
    }
    if (!library.isPro) {
      openPro();
      return;
    }

    setGenerating(true);
    const endpoint = `${WEB_URL}/api/generate-workout`;
    const requestId = `mobile-${Date.now()}`;
    let accessToken = session.access_token;

    const tokenCheck = await supabase.auth.getUser(accessToken);
    if (tokenCheck.error || !tokenCheck.data.user) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token ?? '';
      if (!accessToken) {
        setGenerating(false);
        setError('Your session has expired. Please log in again.');
        return;
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Request-Id': requestId,
        },
        body: JSON.stringify({ durationMins, equipment, focus }),
      });
      const responseText = await response.text();
      const payload = JSON.parse(responseText) as FitnessWorkout & { error?: string };
      if (!response.ok) throw new Error('generation_failed');
      setGeneratedWorkout(payload);
      await library.refresh();
    } catch {
      setError('We could not generate your workout. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [durationMins, equipment, focus, library, openLogin, openPro, session?.access_token]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-lg pb-xl gap-xl"
      >
        <AppTopBar
          leftAccessory={
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close AI workout generator"
              hitSlop={8}
              className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          }
        />

        <ScreenHero
          eyebrow="AI workout"
          headline={'Built for\nyour day'}
          sub="Choose your time, equipment and focus. Get a workout you can start immediately."
        />

        <View className="gap-md">
          <View>
            <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
              Workout filters
            </Text>
            <Text className="font-body text-white/45 text-[12px] leading-[18px] mt-xs">
              Set the session constraints before generating.
            </Text>
          </View>
          <View className="flex-row border-y border-border">
            <DropdownTrigger
              icon="clock"
              label="Duration"
              value={`${durationMins} min`}
              open={openFilter === 'duration'}
              onPress={() => setOpenFilter((current) => current === 'duration' ? null : 'duration')}
            />
            <DropdownTrigger
              icon="tool"
              label="Equipment"
              value={EQUIPMENT.find((option) => option.value === equipment)?.label ?? 'None'}
              open={openFilter === 'equipment'}
              onPress={() => setOpenFilter((current) => current === 'equipment' ? null : 'equipment')}
              divided
            />
            <DropdownTrigger
              icon="target"
              label="Focus"
              value={FOCUS.find((option) => option.value === focus)?.label ?? 'Full body'}
              open={openFilter === 'focus'}
              onPress={() => setOpenFilter((current) => current === 'focus' ? null : 'focus')}
              divided
            />
          </View>

          {openFilter === 'duration' ? (
            <DropdownOptions
              options={DURATIONS.map((value) => ({ value, label: `${value} min` }))}
              value={durationMins}
              onChange={(value) => {
                setDurationMins(value);
                setOpenFilter(null);
              }}
            />
          ) : null}
          {openFilter === 'equipment' ? (
            <DropdownOptions
              options={EQUIPMENT}
              value={equipment}
              onChange={(value) => {
                setEquipment(value);
                setOpenFilter(null);
              }}
            />
          ) : null}
          {openFilter === 'focus' ? (
            <DropdownOptions
              options={FOCUS}
              value={focus}
              onChange={(value) => {
                setFocus(value);
                setOpenFilter(null);
              }}
            />
          ) : null}
        </View>

        {!user ? (
          <LimeButton label="Log in to generate" onPress={openLogin} />
        ) : library.loading ? (
          <LimeButton label="Loading workouts" loading />
        ) : library.proError ? (
          <LimeButton label="Retry access" onPress={() => void library.refresh()} />
        ) : !library.isPro ? (
          <LimeButton label="View Dad Health Pro" onPress={openPro} />
        ) : (
          <LimeButton
            label={generatedWorkout ? 'Regenerate workout' : 'Generate workout'}
            onPress={() => void generate()}
            loading={generating}
          />
        )}

        {error || library.error || library.proError ? (
          <View accessibilityRole="alert" className="rounded-button border border-red-400/40 bg-red-400/10 p-md">
            <Text className="font-body text-red-300 text-[13px] leading-[19px]">
              {error ?? library.error ?? library.proError}
            </Text>
          </View>
        ) : null}

        {displayedWorkout ? (
          <View className="gap-md border-t border-border pt-lg">
            <View className="flex-row items-center justify-between gap-sm">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                Workout ready
              </Text>
              <TagPill label={`${displayedWorkout.exercises.length} moves`} tone="outline" />
            </View>
            <Text className="font-heading text-white text-[30px] leading-[32px] uppercase">
              {displayedWorkout.title}
            </Text>
            <View className="flex-row flex-wrap gap-sm">
              <TagPill label={`${displayedWorkout.duration_mins} min`} />
              <TagPill label={EQUIPMENT.find((item) => item.value === displayedWorkout.equipment)?.label ?? 'None'} />
              <TagPill label={FOCUS.find((item) => item.value === displayedWorkout.focus)?.label ?? 'Full body'} />
            </View>
            <View className="gap-sm">
              {displayedWorkout.exercises.slice(0, 3).map((exercise, index) => (
                <View key={`${exercise.name}-${index}`} className="flex-row items-center gap-md py-sm border-b border-border last:border-b-0">
                  <View className="h-[28px] w-[28px] rounded-button bg-lime/10 items-center justify-center">
                    <Text className="font-heading text-lime text-[13px]">{index + 1}</Text>
                  </View>
                  <Text className="font-heading-bold text-white text-[14px] uppercase flex-1">
                    {exercise.name}
                  </Text>
                </View>
              ))}
            </View>
            {displayedWorkout.exercises.length > 3 ? (
              <Text className="font-body text-white/35 text-[12px]">
                +{displayedWorkout.exercises.length - 3} more moves in the full workout
              </Text>
            ) : null}
            <LimeButton label="View workout" onPress={openWorkout} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DropdownTrigger({
  icon,
  label,
  value,
  divided = false,
  open,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  divided?: boolean;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      className={`flex-1 min-w-0 px-sm py-md active:opacity-75 ${divided ? 'border-l border-border' : ''}`}
    >
      <View className="flex-row items-center gap-xs">
        <Feather name={icon} size={14} color={colors.lime} />
        <Text className="font-heading-bold text-white/40 text-[9px] tracking-[0.8px] uppercase">
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-xs mt-xs">
        <Text numberOfLines={1} adjustsFontSizeToFit className="font-heading-bold text-white text-[12px] uppercase flex-1">
          {value}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.lime} />
      </View>
    </Pressable>
  );
}

function DropdownOptions<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="border-b border-border">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-[44px] flex-row items-center justify-between px-sm active:opacity-75 ${
              index > 0 ? 'border-t border-border' : ''
            } ${selected ? 'bg-lime/10' : ''}`}
          >
            <Text className={`font-heading-bold text-[13px] uppercase ${selected ? 'text-lime' : 'text-white'}`}>
              {option.label}
            </Text>
            {selected ? <Feather name="check" size={17} color={colors.lime} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
