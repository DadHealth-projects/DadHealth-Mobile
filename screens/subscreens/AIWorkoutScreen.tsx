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

import AppTopBar from '../../components/AppTopBar';
import GeneratedWorkoutSection from '../../components/fitness/GeneratedWorkoutSection';
import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import ProPromptModal from '../../components/ProPromptModal';
import ScreenHero from '../../components/mockup/ScreenHero';
import TagPill from '../../components/dashboard/TagPill';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import type { FitnessWorkout } from '../../hooks/useFitnessLibrary';
import { useFitnessLibrary } from '../../hooks/useFitnessLibrary';
import { generateAIWorkout, WorkoutGenerationError } from '../../lib/aiWorkout';
import { PRO_MOMENTS } from '../../lib/proMoments';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

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

/** One workout-options experience: three generations monthly for Free, unlimited for Pro. */
export default function AIWorkoutScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'AIWorkout'>>();
  const { user, session } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const library = useFitnessLibrary(user?.id, true);
  const [durationMins, setDurationMins] = useState<(typeof DURATIONS)[number]>(20);
  const [equipment, setEquipment] = useState<(typeof EQUIPMENT)[number]['value']>('none');
  const [focus, setFocus] = useState<(typeof FOCUS)[number]['value']>('full_body');
  const [generatedWorkout, setGeneratedWorkout] = useState<FitnessWorkout | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<'duration' | 'equipment' | 'focus' | null>(null);
  const [limitPromptOpen, setLimitPromptOpen] = useState(false);

  const displayedWorkout = useMemo(
    () => generatedWorkout
      ?? library.workouts.find((workout) => workout.id === route.params?.workoutId)
      ?? null,
    [generatedWorkout, library.workouts, route.params?.workoutId],
  );

  const close = useCallback(() => navigation.goBack(), [navigation]);
  const openLogin = useCallback(() => navigation.navigate('Login'), [navigation]);
  const openPro = useCallback(() => {
    setLimitPromptOpen(false);
    navigation.navigate('ProSubscription');
  }, [navigation]);
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
    if (isOffline) {
      showOfflineAction('ai_workout');
      return;
    }

    setGenerating(true);
    const generationStartedAt = Date.now();
    try {
      const workout = await generateAIWorkout(session.access_token, {
        durationMins,
        equipment,
        focus,
      });
      await library.refresh();
      const remainingLoadingMs = 1000 - (Date.now() - generationStartedAt);
      if (remainingLoadingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingLoadingMs));
      }
      setGeneratedWorkout(workout);
    } catch (cause) {
      if (cause instanceof WorkoutGenerationError && cause.code === 'free_limit_reached') {
        setLimitPromptOpen(true);
        return;
      }
      setError(cause instanceof WorkoutGenerationError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "We couldn't create your workout right now. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [durationMins, equipment, focus, isOffline, library, openLogin, session?.access_token, showOfflineAction]);

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
          <View className="flex-row items-end justify-between gap-md">
            <View className="flex-1">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                Workout filters
              </Text>
              <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">
                Set the session constraints before generating.
              </Text>
            </View>
            <TagPill label={library.isPro ? 'Unlimited' : '3 free / month'} tone="outline" />
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
                setError(null);
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
                setError(null);
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
                setError(null);
              }}
            />
          ) : null}
        </View>

        <InlineFormError message={isOffline ? null : error ?? library.error ?? library.proError} />

        {!user ? (
          <LimeButton label="Log in to generate" onPress={openLogin} />
        ) : library.loading ? (
          <LimeButton label="Generate workout" loading />
        ) : (
          <LimeButton
            label={generatedWorkout ? 'Generate another workout' : 'Generate workout'}
            onPress={() => void generate()}
            loading={generating}
          />
        )}

        {displayedWorkout ? (
          <GeneratedWorkoutSection workout={displayedWorkout} onOpen={openWorkout} />
        ) : null}
      </ScrollView>
      <ProPromptModal
        visible={limitPromptOpen}
        moment={PRO_MOMENTS.aiWorkout}
        onUpgrade={openPro}
        onDismiss={() => setLimitPromptOpen(false)}
      />
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
        <Text className="font-heading-bold text-tertiary-text text-[9px] tracking-[0.8px] uppercase">
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
