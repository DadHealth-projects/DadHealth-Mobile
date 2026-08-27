import React, { memo } from 'react';
import { Pressable, Text } from 'react-native';

import Card from '../Card';

type UpgradeProCardProps = {
  onPress?: () => void;
};

function UpgradeProCard({ onPress }: UpgradeProCardProps) {
  return (
    <Card className="border-lime/30 gap-sm">
      <Text className="font-heading-bold text-lime text-[13px] tracking-label uppercase">
        Make Dad Health personal
      </Text>
      <Text className="font-body text-muted-text text-[14px] leading-[20px]">
        See what is shaping your score, with insights built around your week.
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="See what Dad Health Pro can do"
        className="mt-sm rounded-button bg-lime py-md items-center active:opacity-90"
      >
        <Text className="font-heading-bold text-dark text-[14px] tracking-[1px] uppercase">
          See what Pro can do
        </Text>
      </Pressable>
    </Card>
  );
}

export default memo(UpgradeProCard);
