import React, { memo } from 'react';
import { Text, View } from 'react-native';

type GreetingHeaderProps = {
  name: string;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

/**
 * The web dashboard greeting (`dashboardPreview/HomeScreen.tsx`) plus the streak
 * from its sidebar, typeset as the mockups' screen opener (eyebrow + oversized
 * condensed headline + muted meta line).
 */
function GreetingHeader({ name }: GreetingHeaderProps) {
  return (
    <View className="gap-xs">
      <Text className="font-heading-semibold text-lime text-[12px] tracking-label uppercase">
        {getGreeting()}
      </Text>
      <Text className="font-heading-bold text-white text-[38px] leading-[39px] uppercase">
        {name}.
      </Text>
      <Text className="font-body text-muted-text text-[17px] leading-[24px]">
        How are you doing today?
      </Text>
    </View>
  );
}

export default memo(GreetingHeader);
