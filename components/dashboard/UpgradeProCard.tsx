import React, { memo } from 'react';
import { Pressable, Text } from 'react-native';

import Card from '../Card';

type UpgradeProCardProps = {
  onPress?: () => void;
};

/**
 * Web "UPGRADE TO PRO" card, shown to non-Pro members on the dashboard Home
 * (`dashboardPreview/HomeScreen.tsx`). Copy is verbatim.
 */
function UpgradeProCard({ onPress }: UpgradeProCardProps) {
  return (
    <Card className="border-lime/30 gap-sm">
      <Text className="font-heading-bold text-lime text-[13px] tracking-label uppercase">
        Upgrade to Pro
      </Text>
      <Text className="font-body text-muted-text text-[14px] leading-[20px]">
        Unlock full score, graphs & more
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Start 7-day free trial"
        className="mt-sm rounded-button bg-lime py-md items-center active:opacity-90"
      >
        <Text className="font-heading-bold text-dark text-[14px] tracking-[1px] uppercase">
          7-day free trial
        </Text>
      </Pressable>
    </Card>
  );
}

export default memo(UpgradeProCard);
