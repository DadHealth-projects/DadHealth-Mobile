import React, { memo } from 'react';
import { Text, View } from 'react-native';

import ScreenHero from '../mockup/ScreenHero';
import TagPill from './TagPill';

type GreetingHeaderProps = {
  /** First name, or `—` when there is no session (web behaviour). */
  name: string;
  weekday: string;
  dateLabel: string;
  dadsCount: number;
  isPro: boolean;
  streak: number | null;
};

/**
 * The web dashboard greeting (`dashboardPreview/HomeScreen.tsx`) plus the streak
 * from its sidebar, typeset as the mockups' screen opener (eyebrow + oversized
 * condensed headline + muted meta line).
 */
function GreetingHeader({ name, weekday, dateLabel, dadsCount, isPro, streak }: GreetingHeaderProps) {
  return (
    <View>
      <ScreenHero eyebrow="Good morning dads" headline={`${name}\n${weekday}`} />

      <View className="flex-row items-center flex-wrap gap-sm mt-md">
        {isPro ? <TagPill label="Pro" /> : null}
        <Text className="font-body text-muted-text text-[14px]">{dateLabel}</Text>
        <View className="h-[4px] w-[4px] rounded-full bg-lime" />
        <Text className="font-body text-muted-text text-[14px]">
          {dadsCount > 0 ? dadsCount.toLocaleString() : '0'} dads in community
        </Text>
        <View className="h-[4px] w-[4px] rounded-full bg-lime" />
        <Text className="font-body text-muted-text text-[14px]">
          {streak === null ? '0-day streak' : `${streak}-day streak`}
        </Text>
      </View>
    </View>
  );
}

export default memo(GreetingHeader);
