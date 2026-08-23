import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { colors } from '../theme';

export default function GlobalConnectivityToast() {
  const { toast } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  const icon = toast.tone === 'offline' ? 'wifi-off' : toast.tone === 'online' ? 'check-circle' : 'alert-circle';

  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{ top: insets.top + 12, zIndex: 1000, elevation: 12 }}
      className="absolute inset-x-lg items-center"
    >
      <View className="max-w-[520px] flex-row items-center gap-sm rounded-button border border-lime/30 bg-[#171A10] px-md py-sm shadow-lg">
        <Feather name={icon} size={16} color={colors.lime} />
        <Text className="flex-1 font-body text-white text-[13px] leading-[18px]">{toast.message}</Text>
      </View>
    </View>
  );
}
