import React from 'react';
import { Pressable, Text } from 'react-native';

import { useAuth } from '../contexts/AuthContext';

type AccountButtonProps = {
  onPress: () => void;
};

/** Shared account avatar used by the full-screen tab experiences. */
export default function AccountButton({ onPress }: AccountButtonProps) {
  const { user, session } = useAuth();
  const initial = session ? (user?.email?.[0] ?? 'D').toUpperCase() : '?';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={8}
      className="h-[40px] w-[40px] rounded-full border border-lime/40 bg-lime/10 items-center justify-center active:opacity-70"
    >
      <Text className="font-heading-bold text-lime text-[16px]">{initial}</Text>
    </Pressable>
  );
}
