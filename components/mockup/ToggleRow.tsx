import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

type ToggleRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
};

/** Mockup 3's `.present-mode` row: title + sub + lime pill toggle. */
function ToggleRow({ title, subtitle, value, onToggle }: ToggleRowProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      className="flex-row items-center justify-between border-y border-lime/25 px-md py-md active:opacity-85"
    >
      <View className="flex-1 pr-md">
        <Text className="font-heading-bold text-white text-[14px] tracking-[0.5px] uppercase">
          {title}
        </Text>
        <Text className="font-body text-white/45 text-[11px] leading-[16px] mt-xs">{subtitle}</Text>
      </View>

      <View
        className={`h-[24px] w-[44px] rounded-full justify-center ${
          value ? 'bg-lime' : 'bg-muted border border-border'
        }`}
      >
        <View
          className={`h-[20px] w-[20px] rounded-full ${
            value ? 'bg-dark ml-auto mr-[2px]' : 'bg-white/40 ml-[2px]'
          }`}
        />
      </View>
    </Pressable>
  );
}

export default memo(ToggleRow);
