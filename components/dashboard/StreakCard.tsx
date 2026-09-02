import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../../theme';

/**
 * The streak is the primary habit mechanic (brief Change 02, position 6).
 *
 * Streak protection is a Pro benefit (checklist item 18): a Pro member's streak
 * survives one missed day. Free members see what that would give them rather
 * than a locked feature.
 */
function StreakCard({
  streak,
  isPro = false,
  onUpgrade,
}: {
  streak: number | null;
  isPro?: boolean;
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
          <Text className="font-heading-bold text-white text-[25px] leading-[27px] uppercase">
            {count > 0 ? `${count}-day streak` : 'Start your streak'}
          </Text>
          <Text className="font-body text-muted-text text-[13px] leading-[19px] mt-xs">
            {count > 0 ? 'Keep showing up—one check-in at a time.' : "Complete today's check-in to begin."}
          </Text>
        </View>
      </View>

      {isPro ? (
        <View className="flex-row items-center gap-sm">
          <Feather name="shield" size={14} color={colors.lime} />
          <Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">
            Streak protected — one missed day won't reset it
          </Text>
        </View>
      ) : onUpgrade ? (
        <View className="gap-sm">
          <Text className="font-body text-tertiary-text text-[12px] leading-[18px]">
            Pro members keep their streak through one missed day.
          </Text>
          <Pressable
            onPress={onUpgrade}
            accessibilityRole="button"
            accessibilityLabel="Protect my streak with Dad Health Pro"
            className="min-h-[44px] self-start justify-center border-b border-lime active:opacity-70"
          >
            <Text className="font-heading-bold text-lime text-[11px] uppercase">Protect my streak</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default memo(StreakCard);
