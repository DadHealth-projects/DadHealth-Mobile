import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { colors } from '../../theme';

function ProBadge() {
  return (
    <View
      accessible
      accessibilityLabel="Pro feature"
      className="flex-row items-center gap-[4px] rounded-full bg-lime px-sm py-[4px]"
    >
      <Feather name="lock" size={10} color={colors.dark} />
      <Text className="font-heading-bold text-dark text-[9px] uppercase">Pro</Text>
    </View>
  );
}

export default memo(ProBadge);
