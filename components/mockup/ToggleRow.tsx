import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

type ToggleRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

/** Mockup 3's `.present-mode` row: title + sub + lime pill toggle. */
function ToggleRow({ title, subtitle, value, onToggle, disabled = false }: ToggleRowProps) {
  return (
    <View className="flex-row items-center justify-between border-y border-lime/25 px-md py-md">
      <View className="flex-1 pr-md">
        <Text className="font-heading-bold text-white text-[14px] tracking-[0.5px] uppercase">
          {title}
        </Text>
        <Text className="font-body text-muted-text text-[11px] leading-[16px] mt-xs">{subtitle}</Text>
      </View>

      <Pressable
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={title}
        hitSlop={10}
        className={`h-[24px] w-[44px] rounded-full justify-center ${
          value ? 'bg-lime' : 'bg-muted border border-border'
        } ${disabled ? 'opacity-60' : 'active:opacity-75'}`}
      >
        <View
          className={`h-[20px] w-[20px] rounded-full ${
            value ? 'bg-dark ml-auto mr-[2px]' : 'bg-white/40 ml-[2px]'
          }`}
        />
      </Pressable>
    </View>
  );
}

export default memo(ToggleRow);
