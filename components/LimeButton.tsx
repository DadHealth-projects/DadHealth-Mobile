import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors, shadows } from '../theme';

type LimeButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

export default function LimeButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
}: LimeButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        shadows.button,
        {
          opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
        },
      ]}
      className="bg-lime rounded-button px-lg py-md items-center justify-center"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.dark} />
      ) : (
        <Text className="font-heading-bold text-dark text-[15px] tracking-[1px] uppercase">
          {label}
        </Text>
      )}
    </Pressable>
  );
}