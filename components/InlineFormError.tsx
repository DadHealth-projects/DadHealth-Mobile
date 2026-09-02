import React from 'react';
import { Text, View } from 'react-native';

type InlineFormErrorProps = {
  message?: string | null;
  /** `lime` inverts the colours for the lime check-in surface. */
  surface?: 'dark' | 'lime';
  className?: string;
};

/**
 * Inline validation / submission error, rendered next to the field or action
 * that produced it. Form errors never go to the top banner or the snackbar.
 */
export default function InlineFormError({ message, surface = 'dark', className = '' }: InlineFormErrorProps) {
  if (!message) return null;

  const onLime = surface === 'lime';

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className={`border-l-2 pl-md ${onLime ? 'border-[#7F1D1D]' : 'border-[#F87171]'} ${className}`}
    >
      <Text className={`font-body text-[13px] leading-[19px] ${onLime ? 'text-[#7F1D1D]' : 'text-[#F87171]'}`}>
        {message}
      </Text>
    </View>
  );
}
