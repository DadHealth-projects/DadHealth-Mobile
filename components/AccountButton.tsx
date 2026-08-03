import React, { memo, useMemo } from 'react';
import { Pressable, Text } from 'react-native';

import { useAuth } from '../contexts/AuthContext';

type AccountButtonProps = {
  onPress: () => void;
};

function AccountButton({ onPress }: AccountButtonProps) {
  const { user, session } = useAuth();

  const initial = useMemo(() => {
    if (!session) return '?';

    const email = user?.email?.trim();
    if (!email) return 'D';

    return email.charAt(0).toUpperCase();
  }, [session, user?.email]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open account"
      accessibilityHint="Opens your account menu"
      hitSlop={10}
      className="h-[44px] w-[44px] rounded-full border border-lime/30 bg-lime/10 items-center justify-center active:opacity-80"
    >
      <Text
        allowFontScaling
        className="font-heading-bold text-lime text-[16px]"
      >
        {initial}
      </Text>
    </Pressable>
  );
}

export default memo(AccountButton);