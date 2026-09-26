import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatScoreTrend } from '../../lib/scoreTrends';

export type ScoreItem = {
  label: string;
  value: number | null;
  trend?: number | null;
  highlighted?: boolean;
  warning?: boolean;
  showNeutralTrend?: boolean;
};

type DadScoreCardProps = {
  score: number | null;
  items: ScoreItem[];
  title?: string;
  scoreLabel?: string;
  ring?: boolean;
  missingScore?: number | string;
  lockedLabel?: string;
  missingItemValue?: string;
  actionLabel?: string;
  onAction?: () => void;
  proTease?: string;
  lockedValues?: boolean;
  compactBottom?: boolean;
  children?: React.ReactNode;
};

function DadScoreCard({
  score,
  items,
  title = "This week's health",
  scoreLabel = 'Dad Score',
  ring = true,
  missingScore = 0,
  lockedLabel,
  missingItemValue,
  actionLabel,
  onAction,
  proTease,
  lockedValues = false,
  compactBottom = false,
  children,
}: DadScoreCardProps) {
  return (
    <View className={`bg-lime rounded-t-[18px] px-xl pt-xl ${compactBottom ? 'pb-md' : 'pb-lg'}`}>
      <View className="flex-row items-center gap-lg">
        {ring ? (
          <View className="h-[100px] w-[100px] rounded-full border-[5px] border-dark items-center justify-center">
            <Text className="font-heading text-dark text-[40px] leading-[40px]">
              {lockedValues ? <Feather name="lock" size={22} color="#080808" /> : score ?? missingScore}
            </Text>

            <Text className="font-heading-bold text-dark/50 text-[9px] tracking-[1.5px] uppercase">
              {scoreLabel}
            </Text>
          </View>
        ) : (
          <View>
            <Text className="font-heading text-dark text-[56px] leading-[52px]">
              {lockedValues ? <Feather name="lock" size={28} color="#080808" /> : score ?? missingScore}
            </Text>
            <Text className="font-heading-bold text-dark/50 text-[10px] tracking-[1.5px] uppercase">
              {scoreLabel}
            </Text>
          </View>
        )}

        <View className="flex-1">
          {lockedLabel ? (
            <View className="min-h-[82px] items-center justify-center gap-sm border-y border-dark/15">
              <Feather name="lock" size={18} color="#080808" />
              <Text className="font-heading-bold text-dark/60 text-[10px] uppercase text-center">
                {lockedLabel}
              </Text>
            </View>
          ) : (
            <>
          {title ? (
            <Text className="font-heading-bold text-dark text-[13px] uppercase tracking-[0.5px] mb-md">
              {title}
            </Text>
          ) : null}

          {items.map((item) => {
            const trend = formatScoreTrend(item.trend);
            const showTrend = item.trend != null || item.showNeutralTrend;
            return (
            <View
              key={item.label}
              className={`mb-sm rounded-[7px] ${item.warning ? 'px-sm py-xs' : ''}`}
              style={item.warning ? { backgroundColor: 'rgba(184, 74, 66, 0.2)' } : undefined}
            >
              <View className="flex-row justify-between mb-[3px]">
                <Text className="font-heading-bold text-dark/60 text-[10px] uppercase tracking-[0.5px]">
                  {item.label}
                </Text>

                {lockedValues ? (
                  <Feather name="lock" size={11} color="#080808" />
                ) : item.value === null ? (
                  missingItemValue ? (
                    <Text className="font-heading-bold text-dark/60 text-[10px]">{missingItemValue}</Text>
                  ) : (
                    <View className="h-[6px] w-[6px] rounded-full bg-dark/50" />
                  )
                ) : (
                  <View className="flex-row items-center gap-xs">
                    <Text className="font-heading-bold text-dark/60 text-[10px]">
                      {item.value}%
                    </Text>
                    {showTrend ? (
                      <Text className="font-heading-bold text-dark text-[10px]">
                        {trend.arrow}{trend.change == null ? '' : ` ${trend.change} pts`}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>

              <View className="h-[5px] rounded-full bg-dark/10 overflow-hidden">
                {item.value !== null ? (
                  <View
                    className="h-full rounded-full bg-dark"
                    style={{
                      width: `${Math.max(0, Math.min(100, item.value))}%`,
                    }}
                  />
                ) : null}
              </View>
            </View>
          );})}
            </>
          )}
        </View>
      </View>

      {children && (
        <>
          <Text className="font-heading-bold text-dark/50 text-[11px] tracking-[2px] uppercase mt-xl mb-md">
            Daily Check-in
          </Text>

          {children}
        </>
      )}

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          className="min-h-[44px] self-center justify-center border-b border-dark mt-md active:opacity-70"
        >
          <Text className="font-heading-bold text-dark text-[11px] uppercase">{actionLabel}</Text>
        </Pressable>
      ) : null}

      {proTease ? (
        <Text className="self-center font-heading-bold text-dark/70 text-[10px] tracking-[1px] uppercase mt-sm">
          {proTease}
        </Text>
      ) : null}

      <View className="items-center mt-xl">
        <View className="w-[120px] h-[4px] rounded-full bg-dark/10" />
      </View>
    </View>
  );
}

export default memo(DadScoreCard);
