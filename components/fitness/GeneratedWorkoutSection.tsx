import React from 'react';
import { Text, View } from 'react-native';

import type { FitnessWorkout } from '../../hooks/useFitnessLibrary';
import LimeButton from '../LimeButton';
import TagPill from '../dashboard/TagPill';

const EQUIPMENT_LABEL = {
  none: 'No equipment',
  dumbbells: 'Dumbbells',
  full_gym: 'Full gym',
} as const;

const FOCUS_LABEL = {
  full_body: 'Full body',
  upper: 'Upper body',
  lower: 'Lower body',
  core: 'Core',
} as const;

export default function GeneratedWorkoutSection({
  workout,
  onOpen,
}: {
  workout: FitnessWorkout;
  onOpen: () => void;
}) {
  return (
    <View className="gap-md border-t border-border pt-lg">
      <View className="flex-row items-center justify-between gap-sm">
        <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
          Workout ready
        </Text>
        <TagPill label={`${workout.exercises.length} moves`} tone="outline" />
      </View>
      <Text className="font-heading text-white text-[30px] leading-[32px] uppercase">
        {workout.title}
      </Text>
      <View className="flex-row flex-wrap gap-sm">
        <TagPill label={`${workout.duration_mins} min`} />
        <TagPill label={EQUIPMENT_LABEL[workout.equipment] ?? 'No equipment'} />
        <TagPill label={FOCUS_LABEL[workout.focus] ?? 'Full body'} />
      </View>
      <View className="gap-sm">
        {workout.exercises.slice(0, 3).map((exercise, index) => (
          <View
            key={`${exercise.name}-${index}`}
            className="flex-row items-center gap-md py-sm border-b border-border last:border-b-0"
          >
            <View className="h-[28px] w-[28px] rounded-button bg-lime/10 items-center justify-center">
              <Text className="font-heading text-lime text-[13px]">{index + 1}</Text>
            </View>
            <Text className="font-heading-bold text-white text-[14px] uppercase flex-1">
              {exercise.name}
            </Text>
          </View>
        ))}
      </View>
      {workout.exercises.length > 3 ? (
        <Text className="font-body text-tertiary-text text-[12px]">
          +{workout.exercises.length - 3} more moves in the full workout
        </Text>
      ) : null}
      <LimeButton label="View workout" onPress={onOpen} />
    </View>
  );
}
