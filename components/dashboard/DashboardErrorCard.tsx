import React, { memo } from 'react';
import { Text } from 'react-native';

import Card from '../Card';
import LimeButton from '../LimeButton';

type DashboardErrorCardProps = {
  message: string;
  onRetry: () => void;
};

function DashboardErrorCard({ message, onRetry }: DashboardErrorCardProps) {
  return (
    <Card className="border-lime/30 gap-md">
      <Text className="font-heading-bold text-white text-[20px] uppercase">
        Couldn't load today's dashboard
      </Text>
      <Text className="font-body text-muted-text text-[14px] leading-[21px]">{message}</Text>
      <LimeButton label="Try again" onPress={onRetry} />
    </Card>
  );
}

export default memo(DashboardErrorCard);
