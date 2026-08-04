import React, { memo } from 'react';
import { Text, View } from 'react-native';

export type ScoreItem = {
  label: string;
  value: number | null;
};

type DadScoreCardProps = {
  score: number | null;
  items: ScoreItem[];
  title?: string;
  scoreLabel?: string;
  ring?: boolean;
  missingScore?: number | string;
  children?: React.ReactNode;
};

function DadScoreCard({
  score,
  items,
  title = "This week's health",
  scoreLabel = 'Dad Score',
  ring = true,
  missingScore = 0,
  children,
}: DadScoreCardProps) {
  return (
    <View className="bg-lime rounded-t-[18px] px-xl pt-xl pb-lg">
      <View className="flex-row items-center gap-lg">
        {ring ? (
          <View className="h-[100px] w-[100px] rounded-full border-[5px] border-dark items-center justify-center">
            <Text className="font-heading text-dark text-[40px] leading-[40px]">
              {score ?? missingScore}
            </Text>

            <Text className="font-heading-bold text-dark/50 text-[9px] tracking-[1.5px] uppercase">
              {scoreLabel}
            </Text>
          </View>
        ) : (
          <View>
            <Text className="font-heading text-dark text-[56px] leading-[52px]">
              {score ?? missingScore}
            </Text>
            <Text className="font-heading-bold text-dark/50 text-[10px] tracking-[1.5px] uppercase">
              {scoreLabel}
            </Text>
          </View>
        )}

        <View className="flex-1">
          {title ? (
            <Text className="font-heading-bold text-dark text-[13px] uppercase tracking-[0.5px] mb-md">
              {title}
            </Text>
          ) : null}

          {items.map((item) => (
            <View key={item.label} className="mb-sm">
              <View className="flex-row justify-between mb-[3px]">
                <Text className="font-heading-bold text-dark/60 text-[10px] uppercase tracking-[0.5px]">
                  {item.label}
                </Text>

                {item.value === null ? (
                  <View className="h-[6px] w-[6px] rounded-full bg-dark/50" />
                ) : (
                  <Text className="font-heading-bold text-dark/60 text-[10px]">
                    {item.value}%
                  </Text>
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
          ))}
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

      <View className="items-center mt-xl">
        <View className="w-[120px] h-[4px] rounded-full bg-dark/10" />
      </View>
    </View>
  );
}

export default memo(DadScoreCard);
