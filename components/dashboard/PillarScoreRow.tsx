import React from 'react';
import { Text, View } from 'react-native';

import { formatScoreTrend } from '../../lib/scoreTrends';

export default function PillarScoreRow({
  pillar,
  score,
  trend,
}: {
  pillar: 'Mind' | 'Body';
  score: number | null;
  trend: number | null;
}) {
  const formattedTrend = formatScoreTrend(trend);

  return (
    <View accessibilityLabel={`${pillar} score ${score ?? 0} percent, trend ${formattedTrend.arrow}${formattedTrend.change == null ? '' : ` ${formattedTrend.change} points`}`} className="min-h-[42px] flex-row items-center justify-between border-b border-border">
      <Text className="font-heading-bold text-muted-text text-[11px] uppercase tracking-label">{pillar} score</Text>
      <View className="flex-row items-center gap-sm">
        <Text className="font-heading-bold text-white text-[14px]">{Math.round(score ?? 0)}%</Text>
        <Text className="font-heading-bold text-lime text-[13px]">
          {formattedTrend.arrow}{formattedTrend.change == null ? '' : ` ${formattedTrend.change} pts`}
        </Text>
      </View>
    </View>
  );
}
