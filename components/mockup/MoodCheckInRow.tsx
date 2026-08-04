import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

export const MOOD_OPTIONS = [
  { key: 'stressed', emoji: '😤', label: 'Stressed', value: 1 },
  { key: 'okay', emoji: '😐', label: 'Okay', value: 2 },
  { key: 'good', emoji: '🙂', label: 'Good', value: 3 },
  { key: 'great', emoji: '😄', label: 'Great', value: 4 },
  { key: 'fired-up', emoji: '⚡', label: 'Fired up', value: 4 },
] as const;

export type MoodKey = (typeof MOOD_OPTIONS)[number]['key'];

type MoodCheckInRowProps = {
  selectedKey: MoodKey;
  onSelect: (key: MoodKey, value: number) => void;
  disabled?: boolean;
};

function MoodCheckInRow({
  selectedKey,
  onSelect,
  disabled = false,
}: MoodCheckInRowProps) {
  return (
    <View className="flex-row gap-2">
      {MOOD_OPTIONS.map((option) => {
        const selected = option.key === selectedKey;

        return (
          <Pressable
            key={option.key}
            disabled={disabled}
            onPress={() => onSelect(option.key, option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            className={`flex-1 items-center justify-center rounded-[8px] border px-1 py-2 ${
              selected
                ? 'border-dark bg-dark/10'
                : 'border-dark/15 bg-transparent'
            }`}
          >
            <Text className="text-[18px]">
              {option.emoji}
            </Text>

            <Text className="mt-[2px] text-[8px] uppercase tracking-[0.5px] font-heading-bold text-dark/60 text-center">
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(MoodCheckInRow);