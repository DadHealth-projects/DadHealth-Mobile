import React, { memo } from 'react';
import { Pressable, Text } from 'react-native';

import Card from '../Card';

type ChallengeCardProps = {
  challenge: { title: string; participants_count: number | null } | null;
  onTakeAction?: () => void;
};

/** Web "THIS WEEK'S CHALLENGE" card, including its fallback wording. */
function ChallengeCard({ challenge, onTakeAction }: ChallengeCardProps) {
  return (
    <Card className="border-lime/30">
      <Text className="font-heading-bold text-lime text-[13px] tracking-label uppercase">
        This week's challenge
      </Text>
      <Text className="font-heading-bold text-white text-[24px] leading-[26px] uppercase mt-sm">
        {challenge?.title ?? 'No active challenge'}
      </Text>
      <Text className="font-body text-muted-text text-[14px] mt-sm">
        {challenge?.participants_count ?? 0} dads taking part
      </Text>
      <Pressable
        onPress={onTakeAction}
        accessibilityRole="button"
        accessibilityLabel="Take action"
        className="self-start border border-lime rounded-button px-md py-sm mt-md active:bg-lime/10"
      >
        <Text className="font-heading-bold text-lime text-[12px] tracking-[0.5px] uppercase">
          Take action →
        </Text>
      </Pressable>
    </Card>
  );
}

export default memo(ChallengeCard);
