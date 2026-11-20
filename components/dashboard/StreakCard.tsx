import React, { memo, useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../../theme';
import ProBadge from './ProBadge';
import { trackEvent } from '../../lib/analytics';

/**
 * The streak is the primary habit mechanic.
 *
 * Streak protection is a Pro benefit (checklist item 18): a Pro member's streak
 * survives one missed day. Free members see what that would give them rather
 * than a locked feature.
 */
function StreakCard({
  status, error, onRetry, freezeAccess = null, onUpgrade, userId,
}: {
  status: import('../../hooks/useStreakStatus').LiveStreakStatus | null;
  error: string | null;
  onRetry: () => void;
  freezeAccess?: boolean | null;
  onUpgrade?: () => void;
  userId?: string;
}) {
  const count = status?.state === 'current' ? status.count : null;
  const lockViewed = useRef(false);
  useEffect(() => {
    if (freezeAccess !== false || lockViewed.current) return;
    lockViewed.current = true;
    trackEvent('lock_viewed', { feature: 'streak_freeze', source: 'streak_freeze' }, userId);
  }, [freezeAccess, userId]);

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
            className="font-heading-bold text-white text-[22px] leading-[26px] uppercase"
          >
            {count !== null
              ? count > 0 ? `${count}-day streak` : 'Start your streak'
              : error ? 'Streak unavailable' : 'Your check-in streak'}
          </Text>
          <Text className="font-body text-white text-[14px] leading-[20px] mt-xs">
            {error
              ? status
                ? 'Showing your last verified streak.'
                : 'We couldn’t load your streak. Try again.'
              : count === null
                ? 'Your streak count is currently unavailable.'
                : count > 0
                  ? 'Keep showing up—one check-in at a time.'
                  : "Complete today's check-in to begin."}
          </Text>
        </View>
      </View>

      {status ? <View className="gap-sm">
        <View className="flex-row justify-between">
          {status.calendarDays.map(date => {
            const protectedDay = status.state === 'current' && status.protectedDates.includes(date);
            return <View key={date} className="items-center gap-xs" accessibilityLabel={`${date}${protectedDay ? ', Streak protected' : ''}`}>
              <Text className="font-body text-white text-[12px]">{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</Text>
              <Text className="font-body text-white text-[12px]">{Number(date.slice(-2))}</Text>
              {protectedDay ? <Text className="text-[#9DDFFF]">❄</Text> : null}
            </View>;
          })}
        </View>
        {status.protectedDates.length ? <Text className="font-body text-[#9DDFFF] text-[12px]">
          {status.state === 'current' && !error ? 'Streak protected' : 'Previously recorded protection'} · {status.protectedDates.join(', ')}
        </Text> : null}
      </View> : null}
      {(freezeAccess === true || status?.allowance === 1) && status?.state === 'current' && !error && status.allowance !== null ? (
        <Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">
          {status.allowance === 1 ? 'One automatic freeze available this week' : status.protectedDates.length ? 'Freeze used · Resets Monday' : 'No freeze available this week'}
        </Text>
      ) : freezeAccess === false && onUpgrade ? (
        <Pressable
          onPress={onUpgrade}
          accessibilityRole="button"
          accessibilityLabel="Freeze your streak once a week with Dad Health Pro"
          className="min-h-[60px] flex-row items-center justify-between gap-md py-md active:opacity-70"
        >
          <Text className="flex-1 font-heading-bold text-white text-[22px] uppercase leading-[26px]">
            Freeze your streak once a week
          </Text>
          <ProBadge />
          <Feather name="arrow-right" size={18} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

export default memo(StreakCard);
