import React, { memo, useMemo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { checkInRecommendation, type CheckInAction } from '../../lib/checkInRecommendation';

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

        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => onAction(advice.action)}
            accessibilityRole="button"
            accessibilityLabel={advice.actionLabel}
            className="min-h-[44px] justify-center active:opacity-70"
          >
            <Text className="font-heading-bold text-lime text-[11px] uppercase underline decoration-lime">
              {advice.actionLabel}
            </Text>
          </Pressable>
          <View className="flex-row items-center gap-xs">
            <Pressable
              onPress={onPlan}
              accessibilityRole="button"
              accessibilityLabel={isPro ? 'Build my plan' : 'See what Pro can do'}
              className="min-h-[44px] justify-center active:opacity-70"
            >
              <Text className="font-heading-bold text-lime text-[11px] uppercase text-right underline decoration-lime">
                {isPro ? 'Build my plan' : 'See what Pro can do'}
              </Text>
            </Pressable>
            {!isPro ? (
              <View
                accessible
                accessibilityLabel="Pro feature"
                className="flex-row items-center gap-[3px] rounded-full bg-lime px-xs py-[3px]"
              >
                <Feather name="lock" size={9} color="#0A0A0A" />
                <Text className="font-heading-bold text-dark text-[8px] uppercase">PRO</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export default memo(CheckInFollowUp);
