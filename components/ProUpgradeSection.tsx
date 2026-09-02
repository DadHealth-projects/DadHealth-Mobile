import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import LimeButton from './LimeButton';
import { colors } from '../theme';
import type { ProMoment } from '../lib/proMoments';

type ProUpgradeSectionProps = {
  moment: ProMoment;
  onPress: () => void;
  /** Replaces the moment body — used for the Home tease, which leads with the
   *  dad's own improvement before the Pro line. */
  lead?: string | null;
  /** `sm` keeps the section quiet when it sits inside another section. */
  size?: 'lg' | 'sm';
  className?: string;
};

/**
 * A Pro upgrade moment as a flat native section: label → heading → supporting
 * copy → action → divider, the same composition the Body screen uses.
 *
 * The label leads and the lock is a small trailing glyph, because the brief
 * rules out making a lock icon the first thing on a screen.
 */
function ProUpgradeSection({
  moment,
  onPress,
  lead,
  size = 'lg',
  className = '',
}: ProUpgradeSectionProps) {
  const large = size === 'lg';

  return (
    <View className={`gap-md border-b border-border pb-lg ${className}`}>
      <View>
        <View className="flex-row items-center gap-xs">
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
            {moment.eyebrow}
          </Text>
          <Feather name="lock" size={11} color={colors.lime} />
        </View>

        <Text
          className={`font-heading text-white uppercase mt-xs ${
            large ? 'text-[28px] leading-[30px]' : 'text-[20px] leading-[22px]'
          }`}
        >
          {moment.heading}
        </Text>

        {lead ? (
          <Text className="font-body text-white text-[13px] leading-[19px] mt-sm">{lead}</Text>
        ) : null}

        <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-sm">
          {moment.body}
        </Text>
      </View>

      {large ? (
        <LimeButton label={moment.cta} onPress={onPress} />
      ) : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={moment.cta}
          className="min-h-[44px] self-start justify-center border-b border-lime active:opacity-70"
        >
          <Text className="font-heading-bold text-lime text-[11px] uppercase">{moment.cta}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default memo(ProUpgradeSection);
