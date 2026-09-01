import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { colors } from '../../theme';

function StreakCard({ streak }: { streak: number | null }) {
  const count = Math.max(0, streak ?? 0);
  return (
    <View className="border-b border-border pb-lg flex-row items-center gap-lg">
      <View className="h-[54px] w-[54px] rounded-full bg-lime items-center justify-center">
        <Feather name="zap" size={25} color={colors.dark} />
      </View>
      <View className="flex-1">
        <Text className="font-heading-bold text-white text-[25px] leading-[27px] uppercase">
          {count > 0 ? `${count}-day streak` : 'Start your streak'}
        </Text>
        <Text className="font-body text-muted-text text-[13px] leading-[19px] mt-xs">
          {count > 0 ? 'Keep showing up—one check-in at a time.' : "Complete today's check-in to begin."}
        </Text>
      </View>
    </View>
  );
}

export default memo(StreakCard);
