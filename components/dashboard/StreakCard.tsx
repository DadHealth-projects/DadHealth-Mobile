import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../../theme';
import ProBadge from './ProBadge';

/**
 * The streak is the primary habit mechanic (brief Change 02, position 6).
 *
 * Streak protection is a Pro benefit (checklist item 18): a Pro member's streak
 * survives one missed day. Free members see what that would give them rather
 * than a locked feature.
 */
function StreakCard({
  streak,
  isPro = null,
  freezeUsedThisWeek = null,
  freezesRemaining = null,
  onUpgrade,
}: {
  streak: number | null;
  isPro?: boolean | null;
  freezeUsedThisWeek?: boolean | null;
  freezesRemaining?: number | null;
  onUpgrade?: () => void;
}) {
  const count = Math.max(0, streak ?? 0);

  return (
    <View className="border-b border-border pb-lg gap-md">
      <View className="flex-row items-center gap-lg">
        <View className="h-[54px] w-[54px] rounded-full bg-lime items-center justify-center">
          <Feather name="zap" size={25} color={colors.dark} />
        </View>
        <View className="flex-1">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            className="font-heading-bold text-white text-[25px] leading-[27px] uppercase"
          >
            {count > 0 ? `${count}-day streak` : 'Start your streak'}
          </Text>
          <Text className="font-body text-muted-text text-[13px] leading-[19px] mt-xs">
            {count > 0 ? 'Keep showing up—one check-in at a time.' : "Complete today's check-in to begin."}
          </Text>
        </View>
      </View>

      {isPro === true && freezeUsedThisWeek !== null && freezesRemaining !== null ? (
        <View className="flex-row items-center gap-sm">
          <Feather name="shield" size={14} color={colors.lime} />
          <Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">
            {freezeUsedThisWeek
              ? 'Freeze used · Resets Monday'
              : `Streak protected · ${freezesRemaining} ${freezesRemaining === 1 ? 'freeze' : 'freezes'} left this week`}
          </Text>
        </View>
      ) : isPro === false && onUpgrade ? (
        <Pressable
          onPress={onUpgrade}
          accessibilityRole="button"
          accessibilityLabel="Freeze your streak once a week with Dad Health Pro"
          className="min-h-[44px] flex-row items-center justify-between gap-sm rounded-[8px] bg-card px-md active:opacity-70"
          style={{
            borderWidth: 1,
            borderStyle: 'dotted',
            borderColor: 'rgba(200,245,90,0.45)',
          }}
        >
          <Text className="flex-1 font-heading-bold text-white text-[10px] tracking-label uppercase">
            Freeze your streak once a week
          </Text>
          <ProBadge />
        </Pressable>
      ) : null}
    </View>
  );
}

export default memo(StreakCard);
