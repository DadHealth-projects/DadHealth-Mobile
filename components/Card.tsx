import React, { memo } from 'react';
import {
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';

import { shadows } from '../theme';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

function Card({
  children,
  className = '',
  style,
}: CardProps) {
  return (
    <View
      accessible={false}
      style={[shadows.card, style]}
      className={`bg-card border border-border rounded-card p-lg ${className}`}
    >
      {children}
    </View>
  );
}

export default memo(Card);