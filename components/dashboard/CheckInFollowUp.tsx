import React, { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { checkInRecommendation, type CheckInAction } from '../../lib/checkInRecommendation';
import ProBadge from './ProBadge';

/**
 * Moment 2 — what a dad sees straight after the daily check-in: one free
 * recommendation drawn from what he just reported, then the Pro line beside it.
 */
function CheckInFollowUp({
  moodValue,
  stressLevel,
  isPro,
  onAction,
  onPlan,
}: {
  moodValue: number;
  stressLevel: number | null;
  isPro: boolean;
  onAction: (action: CheckInAction) => void;
  onPlan: () => void;
}) {
  const advice = useMemo(
    () => checkInRecommendation(moodValue, stressLevel),
    [moodValue, stressLevel],
  );
  return (
    <View className="gap-lg">
      <View className="gap-md border-b border-border pb-lg">
        <View>
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
            Your check-in
          </Text>
          <Text className="font-heading text-white text-[24px] leading-[26px] uppercase mt-xs">
            {advice.state}
          </Text>
          <Text className="font-body text-muted-text text-[13px] leading-[19px] mt-sm">
            {advice.recommendation}
          </Text>
        </View>

        <View className="gap-sm">
          <Pressable
            onPress={() => onAction(advice.action)}
            accessibilityRole="button"
            accessibilityLabel={advice.actionLabel}
            className="min-h-[48px] w-full items-center justify-center rounded-[7px] bg-lime px-md active:opacity-80"
          >
            <Text className="font-heading-bold text-dark text-[11px] tracking-label uppercase">
              {advice.actionLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={onPlan}
            accessibilityRole="button"
            accessibilityLabel={isPro ? 'Build my plan' : 'Build my plan with Dad Health Pro'}
            className="min-h-[60px] flex-row items-center justify-between gap-md rounded-[8px] bg-[#111214] px-md active:opacity-70"
            style={{
              borderWidth: 1,
              borderStyle: 'dotted',
              borderColor: 'rgba(200,245,90,0.45)',
            }}
          >
            <View className="flex-1">
              <Text className="font-heading-bold text-white text-[12px] uppercase">
                Build my plan
              </Text>
              <Text className="font-body text-muted-text text-[10px] leading-[14px] mt-[3px]">
                A plan around your mood and score.
              </Text>
            </View>
            {!isPro ? <ProBadge /> : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default memo(CheckInFollowUp);
