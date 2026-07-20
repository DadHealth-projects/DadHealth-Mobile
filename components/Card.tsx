import React from 'react';
import { View } from 'react-native';
import { shadows } from '../theme';

type CardProps = {
  children: React.ReactNode;
  /** Extra Tailwind classes appended after the base card styles. */
  className?: string;
};

/**
 * Rounded, bordered, shadowed surface — the mobile equivalent of web `.card-dark`
 * (bg-card + border-border) with a 16px radius and depth.
 */
export default function Card({ children, className = '' }: CardProps) {
  return (
    <View
      style={shadows.card}
      className={`bg-card border border-border rounded-card p-lg ${className}`}
    >
      {children}
    </View>
  );
}
