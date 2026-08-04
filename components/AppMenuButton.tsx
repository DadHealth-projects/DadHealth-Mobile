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
      accessibilityLabel="Open navigation menu"
      accessibilityHint="Opens the Dad Health app menu"
      hitSlop={10}
      className="h-[44px] w-[44px] rounded-button border border-lime/30 bg-lime/10 items-center justify-center active:opacity-80"
    >
      <Feather name="menu" size={22} color={colors.lime} />
    </Pressable>
  );
}

export default memo(AppMenuButton);
