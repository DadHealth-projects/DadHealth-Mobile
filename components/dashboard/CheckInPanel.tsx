import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../../theme';

function CheckInPanel({ checkedInToday, onPress }: { checkedInToday: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={checkedInToday ? "Review today's check-in" : "Start today's check-in"}
      className="min-h-[76px] flex-row items-center gap-md rounded-card border border-lime/30 bg-card px-lg py-md active:opacity-80"
    >
      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-lime/10">
        <Feather name={checkedInToday ? 'check-circle' : 'calendar'} size={21} color={colors.lime} />
      </View>
      <View className="flex-1">
        <Text className="font-heading-bold text-white text-[15px] uppercase">
          {checkedInToday ? 'Check-in complete' : 'Daily check-in'}
        </Text>
        <Text className="font-body text-muted-text text-[13px] leading-[18px] mt-xs">
          {checkedInToday ? 'Review your Mind, Body and Bond answers.' : 'A quick moment for your Mind, Body and Bond.'}
        </Text>
      </View>
      <Feather name="arrow-right" size={19} color={colors.lime} />
    </Pressable>
  );
}

export default memo(CheckInPanel);
