import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../../theme';

type TodayFocusCardProps = {
  title: string;
  description: string;
  actionLabel: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
};

function TodayFocusCard({ title, description, actionLabel, icon, onPress }: TodayFocusCardProps) {
  return (
    <View>
      <Text className="font-heading-semibold text-lime text-[12px] tracking-label uppercase mb-sm">
        Your one focus
      </Text>
      <View className="border-b border-border pb-lg gap-md">
        <View className="flex-row gap-md items-start">
          <View className="h-[44px] w-[44px] rounded-button bg-lime/10 items-center justify-center">
            <Feather name={icon} size={21} color={colors.lime} />
          </View>
          <View className="flex-1 gap-xs">
            <Text className="font-heading-bold text-white text-[21px] leading-[23px] uppercase">
              {title}
            </Text>
            <Text className="font-body text-muted-text text-[14px] leading-[20px]">
              {description}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          className="rounded-button bg-lime py-md items-center active:opacity-90"
        >
          <Text className="font-heading-bold text-dark text-[14px] tracking-[1px] uppercase">
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(TodayFocusCard);
