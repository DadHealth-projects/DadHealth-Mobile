import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { colors, shadows } from '../theme';

type LimeButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Lime accent button — web `LimeButton`. Rounded (12px), lime fill that shifts
 * to lime-hover and dims on press for a clear active state, with a lime glow.
 */
export default function LimeButton({ label, onPress, disabled = false, loading = false }: LimeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={shadows.button}
      className="bg-lime rounded-button px-lg py-md items-center justify-center active:bg-lime-hover active:opacity-90 disabled:opacity-50"
    >
      {loading ? <ActivityIndicator color={colors.dark} /> : (
        <Text className="font-heading-bold text-dark text-[15px] tracking-[1px] uppercase">{label}</Text>
      )}
    </Pressable>
  );
}
