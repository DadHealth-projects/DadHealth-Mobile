import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

type FilterChipsProps<T extends string> = {
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: T;
  onSelect: (value: T) => void;
};

/** Mockup 5's `.filter-row` chips. */
function FilterChips<T extends string>({ options, selected, onSelect }: FilterChipsProps<T>) {
  return (
    <View className="flex-row flex-wrap gap-sm">
      {options.map((option) => {
        const on = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={option.label}
            className={`rounded-full border-[1.5px] px-md py-xs ${
              on ? 'border-lime bg-lime/[0.06]' : 'border-white/10'
            }`}
          >
            <Text
              className={`font-heading-bold text-[10px] tracking-[0.5px] uppercase ${
                on ? 'text-lime' : 'text-white/40'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(FilterChips) as typeof FilterChips;
