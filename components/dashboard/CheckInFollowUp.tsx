import React, { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import ProUpgradeSection from '../ProUpgradeSection';
import { PRO_MOMENTS } from '../../lib/proMoments';
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
  onUpgrade,
}: {
  moodValue: number;
  stressLevel: number | null;
  isPro: boolean;
  onAction: (action: CheckInAction) => void;
  onUpgrade: () => void;
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

        <Pressable
          onPress={() => onAction(advice.action)}
          accessibilityRole="button"
          accessibilityLabel={advice.actionLabel}
          className="min-h-[44px] self-start justify-center border-b border-lime active:opacity-70"
        >
          <Text className="font-heading-bold text-lime text-[11px] uppercase">
            {advice.actionLabel}
          </Text>
        </Pressable>
      </View>

      {!isPro ? (
        <ProUpgradeSection moment={PRO_MOMENTS.checkIn} onPress={onUpgrade} size="sm" />
      ) : null}
    </View>
  );
}

export default memo(CheckInFollowUp);
