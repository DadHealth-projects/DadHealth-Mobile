import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../theme';
import type { ProMoment } from '../lib/proMoments';

type ProLockedPreviewProps = {
  lock: ProMoment;
  onPress: () => void;
  /** The real feature, rendered dimmed behind the lock. */
  children: React.ReactNode;
  className?: string;
};

/**
 * A Pro feature shown as a visible preview behind a lock — the brief's rule is
 * "never block a feature without showing a preview of what is behind the lock".
 *
 * The real content renders underneath at reduced opacity and is not
 * interactive; the label, copy and action sit below it in the usual flat
 * section composition.
 */
export default function ProLockedPreview({
  lock,
  onPress,
  children,
  className = '',
}: ProLockedPreviewProps) {
  return (
    <View className={`gap-md border-b border-border pb-lg ${className}`}>
      <View>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ opacity: 0.28 }}
        >
          {children}
        </View>

        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View className="h-[42px] w-[42px] rounded-full bg-dark/80 border border-lime/40 items-center justify-center">
            <Feather name="lock" size={17} color={colors.lime} />
          </View>
        </View>
      </View>

      <View>
        <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
          {lock.eyebrow}
        </Text>
        <Text className="font-heading-bold text-white text-[17px] uppercase mt-xs">
          {lock.heading}
        </Text>
        <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">
          {lock.body}
        </Text>
      </View>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={lock.cta}
        className="min-h-[44px] self-start justify-center border-b border-lime active:opacity-70"
      >
        <Text className="font-heading-bold text-lime text-[11px] uppercase">{lock.cta}</Text>
      </Pressable>
    </View>
  );
}
