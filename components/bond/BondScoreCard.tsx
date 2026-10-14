import React, { memo } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../../theme';
import { formatScoreTrend } from '../../lib/scoreTrends';

function BondScoreCard({ score, trend, scoreUnavailable = false, baselineBuilding = false }: { score: number | null; trend: number | null; scoreUnavailable?: boolean; baselineBuilding?: boolean }) {
  const value = Math.round(score ?? 0);
  const progress = Math.min(100, Math.max(0, value));
  const formattedTrend = formatScoreTrend(trend);

  return (
    <View className="bg-lime rounded-t-[18px] px-xl pt-xl pb-lg overflow-hidden">
      <View className="flex-row items-center gap-lg">
        <View>
          <Text className="font-heading text-dark text-[56px] leading-[52px]">
            {scoreUnavailable ? '—' : baselineBuilding ? <Text className="font-heading text-dark/45 text-[34px] leading-[38px] text-center">·</Text> : value}
          </Text>
          <Text className="font-heading-bold text-dark/50 text-[10px] tracking-[1.5px] uppercase">out of 100</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-sm mb-md">
            <Feather name="heart" size={16} color={colors.dark} />
            <Text className="font-heading-bold text-dark text-[13px] tracking-[0.5px] uppercase">Bond score</Text>
            {!scoreUnavailable && !baselineBuilding ? <Text className="font-heading-bold text-dark text-[11px]">{formattedTrend.arrow}{formattedTrend.change == null ? '' : ` ${formattedTrend.change} pts`}</Text> : null}
          </View>
          {!baselineBuilding ? <View className="h-[5px] rounded-full bg-dark/10 overflow-hidden">
            <View className="h-full rounded-full bg-dark" style={{ width: `${progress}%` }} />
          </View> : null}
        </View>
      </View>
      {!scoreUnavailable && baselineBuilding ? <Text accessibilityLiveRegion="polite" className="font-heading-bold text-dark/70 text-[11px] tracking-label uppercase mt-md text-center">Building first 7 day trend</Text> : null}
    </View>
  );
}

export default memo(BondScoreCard);
