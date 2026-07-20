import React from 'react';
import { Pressable, Text } from 'react-native';
import { shadows } from '../theme';

type LimeButtonProps = {
  label: string;
  onPress?: () => void;
};

/**
 * Lime accent button — web `LimeButton`. Rounded (12px), lime fill that shifts
 * to lime-hover and dims on press for a clear active state, with a lime glow.
 */
export default function LimeButton({ label, onPress }: LimeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={shadows.button}
      className="bg-lime rounded-button px-lg py-md items-center justify-center active:bg-lime-hover active:opacity-90"
    >
      <Text className="font-heading-bold text-dark text-[15px] tracking-[1px] uppercase">
        {label}
      </Text>
    </Pressable>
  );
}
