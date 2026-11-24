import React from 'react';
import { Text, View } from 'react-native';

import { formatScoreTrend } from '../../lib/scoreTrends';

export default function PillarScoreRow({
  pillar,
  score,
  trend,
  scoreUnavailable = false,
  baselineBuilding = false,
}: {
  pillar: 'Mind' | 'Body';
  score: number | null;
  trend: number | null;
  scoreUnavailable?: boolean;
  baselineBuilding?: boolean;
}) {
  const formattedTrend = formatScoreTrend(trend);
  // A missing score is shown as unknown, never as a fabricated 0.
  const value = score === null || !Number.isFinite(score) ? null : Math.round(score);

  return (
    <View
      accessibilityLabel={scoreUnavailable || value === null
        ? `${pillar} score unavailable`
        : baselineBuilding
          ? `${pillar} score ${value} percent. Building first 7 day trend`
          : `${pillar} score ${value} percent, trend ${formattedTrend.arrow}${formattedTrend.change == null ? '' : ` ${formattedTrend.change} points`}`}
      className="min-h-[42px] flex-row items-center justify-between border-b border-border"
    >
      <Text className="font-heading-bold text-muted-text text-[11px] uppercase tracking-label">{pillar} score</Text>
      <View className="flex-row items-center gap-sm">
        {scoreUnavailable || value === null ? (
          <Text className="font-heading-bold text-white text-[14px]">—</Text>
        ) : (
          <Text className="font-heading-bold text-white text-[14px]">{`${value}%`}</Text>
        )}
        {!scoreUnavailable && value !== null && baselineBuilding ? (
          <Text numberOfLines={2} className="max-w-[154px] text-right font-heading-bold text-muted-text text-[10px]">
            Building first 7 day trend
          </Text>
        ) : null}
        {!scoreUnavailable && value !== null && !baselineBuilding ? (
          <Text className="font-heading-bold text-lime text-[13px]">
            {formattedTrend.arrow}{formattedTrend.change == null ? '' : ` ${formattedTrend.change} pts`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
