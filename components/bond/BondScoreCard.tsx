import React, { memo } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../../theme';

function BondScoreCard({ score }: { score: number }) {
  const progress = Math.min(100, Math.max(0, score));

  return (
    <View className="bg-lime rounded-t-[18px] px-xl pt-xl pb-lg overflow-hidden">
      <View className="flex-row items-center gap-lg">
        <View>
          <Text className="font-heading text-dark text-[56px] leading-[52px]">{score}</Text>
          <Text className="font-heading-bold text-dark/50 text-[10px] tracking-[1.5px] uppercase">out of 100</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-sm mb-md">
            <Feather name="heart" size={16} color={colors.dark} />
            <Text className="font-heading-bold text-dark text-[13px] tracking-[0.5px] uppercase">Bond score</Text>
          </View>
          <View className="h-[5px] rounded-full bg-dark/10 overflow-hidden">
            <View className="h-full rounded-full bg-dark" style={{ width: `${progress}%` }} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default memo(BondScoreCard);
