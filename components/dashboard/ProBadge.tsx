import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { colors } from '../../theme';

function ProBadge({ variant = 'pro' }: { variant?: 'pro' | 'trial' }) {
  const isTrial = variant === 'trial';
  return (
    <View
      accessible
      accessibilityLabel={isTrial ? 'Pro trial access' : 'Pro feature'}
      className="flex-row items-center gap-[4px] rounded-full bg-lime px-sm py-[4px]"
    >
      {isTrial ? <Feather name="check" size={10} color={colors.dark} /> : <Feather name="lock" size={10} color={colors.dark} />}
      <Text className="font-heading-bold text-dark text-[9px] uppercase">{isTrial ? 'Trial' : 'Pro'}</Text>
    </View>
  );
}

export default memo(ProBadge);
