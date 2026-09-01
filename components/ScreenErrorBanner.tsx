import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { colors } from '../theme';

/** Clears the bottom tab bar so an error never sits on top of navigation. */
const TAB_BAR_CLEARANCE = 78;

/**
 * Feature and screen errors, shown in the screen at the bottom. Connectivity
 * notices keep the separate top toast (`GlobalConnectivityToast`).
 */
export default function ScreenErrorBanner() {
  const { screenError } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (!screenError) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{ bottom: insets.bottom + TAB_BAR_CLEARANCE, zIndex: 900, elevation: 10 }}
      className="absolute inset-x-lg items-center"
    >
      <View className="w-full max-w-[520px] flex-row items-start gap-sm rounded-button border border-border bg-[#171A10] px-md py-sm shadow-lg">
        <Feather name="alert-circle" size={16} color={colors.lime} />
        <Text className="flex-1 font-body text-white text-[13px] leading-[18px]">{screenError}</Text>
      </View>
    </View>
  );
}
