import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { colors } from '../theme';

/** Clears the bottom navigation so the snackbar never sits on top of the tabs. */
const BOTTOM_NAV_CLEARANCE = 78;

/**
 * The one transient notice surface: a small bottom snackbar that auto-dismisses.
 * Temporary request failures and short connectivity transitions land here.
 * Persistent offline state uses the top banner; form validation stays inline.
 */
export default function GlobalConnectivityToast() {
  const { toast } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  const icon = toast.tone === 'online' ? 'check-circle' : 'alert-circle';
  const accent = toast.tone === 'error' ? '#F87171' : colors.lime;
  const border = toast.tone === 'error' ? 'border-[#F87171]/40' : 'border-lime/30';

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
        <Text className="flex-1 font-body text-white text-[13px] leading-[18px]">{toast.message}</Text>
      </View>
    </View>
  );
}
