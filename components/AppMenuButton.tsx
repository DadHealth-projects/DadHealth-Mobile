import React, { memo } from 'react';
import { Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../theme';

type AppMenuButtonProps = {
  onPress: () => void;
};

function AppMenuButton({ onPress }: AppMenuButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open dashboard sections"
      accessibilityHint="Opens the Dashboard subsection menu"
      hitSlop={10}
      className="h-[44px] w-[44px] rounded-button border border-lime/30 bg-lime/10 items-center justify-center active:opacity-80"
    >
      <Feather name="chevron-left" size={24} color={colors.lime} />
    </Pressable>
  );
}

export default memo(AppMenuButton);
