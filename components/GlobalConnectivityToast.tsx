import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { colors } from '../theme';

/** Clears the bottom navigation so the snackbar never sits on top of the tabs. */
const BOTTOM_NAV_CLEARANCE = 78;

/**
 * Shared bottom snackbar for connectivity and short-lived request notices.
 * Offline state stays visible until connectivity returns; form errors stay inline.
 */
export default function GlobalConnectivityToast() {
  const { toast, isOffline } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  const message = isOffline
    ? toast && toast.tone !== 'online' ? toast.message : "You're offline. Some features may be unavailable."
    : toast?.message ?? null;
  if (!message) return null;

  const tone = toast?.tone ?? 'neutral';
  const icon = tone === 'online' ? 'check-circle' : tone === 'error' ? 'alert-circle' : 'wifi-off';
  const accent = tone === 'error' ? '#F87171' : colors.lime;
  const border = tone === 'error' ? 'border-[#F87171]/40' : 'border-lime/30';

  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{ bottom: insets.bottom + BOTTOM_NAV_CLEARANCE, zIndex: 1000, elevation: 12 }}
      className="absolute inset-x-lg items-center"
    >
      <View className={`max-w-[520px] flex-row items-center gap-sm rounded-button border bg-[#171A10] px-md py-sm shadow-lg ${border}`}>
        <Feather name={icon} size={15} color={accent} />
        <Text className="flex-1 font-body text-white text-[13px] leading-[18px]">{message}</Text>
      </View>
    </View>
  );
}
