import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../theme';

type LoadErrorStateProps = {
  title: string;
  message: string;
  onRetry: () => void;
};

function LoadErrorState({ title, message, onRetry }: LoadErrorStateProps) {
  return (
    <View accessibilityRole="alert" className="py-xl">
      <View className="h-[3px] w-[40px] bg-lime mb-lg" />
      <Text className="font-heading-bold text-white text-[24px] leading-[27px] uppercase">
        {title}
      </Text>
      <Text className="font-body text-muted-text text-[14px] leading-[21px] mt-sm max-w-[520px]">
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        className="min-h-[44px] flex-row items-center gap-sm self-start border-b border-lime mt-lg active:opacity-70"
      >
        <Feather name="refresh-cw" size={15} color={colors.lime} />
        <Text className="font-heading-bold text-lime text-[11px] tracking-[1px] uppercase">
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

export default memo(LoadErrorState);
