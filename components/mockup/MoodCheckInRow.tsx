import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

export const MOOD_OPTIONS = [
  { key: 'very-low', emoji: '😣', label: 'Struggling', value: 1 },
  { key: 'low', emoji: '🙁', label: 'Low', value: 2 },
  { key: 'okay', emoji: '😐', label: 'Okay', value: 3 },
  { key: 'good', emoji: '🙂', label: 'Good', value: 4 },
  { key: 'great', emoji: '😄', label: 'Great', value: 5 },
] as const;

export type MoodKey = (typeof MOOD_OPTIONS)[number]['key'];

type MoodCheckInRowProps = {
  selectedKey: MoodKey;
  onSelect: (key: MoodKey, value: number) => void;
  disabled?: boolean;
  lowestLabel?: string;
};

function MoodCheckInRow({
  selectedKey,
  onSelect,
  disabled = false,
  lowestLabel,
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
            accessibilityLabel={option.key === 'very-low' ? lowestLabel ?? option.label : option.label}
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
              {option.key === 'very-low' ? lowestLabel ?? option.label : option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(MoodCheckInRow);
