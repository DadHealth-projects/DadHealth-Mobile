import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { colors } from '../theme';

/**
 * The one top status banner in the app. It is reserved for persistent global
 * conditions — offline mode — and never used for form validation or normal API
 * errors, which stay inline or in the bottom snackbar.
 *
 * The banner sits in the layout flow above the app rather than overlaying it,
 * so it never covers the top bar. While it is visible it claims the top safe
 * area inset and hands a zeroed top inset to the screens below, keeping the
 * existing `SafeAreaView edges={['top']}` screens from padding twice.
 */
export default function OfflineStatusBanner({ children }: { children: ReactNode }) {
  const { banner } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      {banner ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{ paddingTop: insets.top }}
          className="border-b border-lime/25 bg-[#171A10]"
        >
          <View className="flex-row items-center gap-sm px-lg py-sm">
            <Feather name="wifi-off" size={15} color={colors.lime} />
            <Text className="flex-1 font-body text-white text-[12px] leading-[17px]">
              {banner.message}
            </Text>
          </View>
        </View>
      ) : null}

      <SafeAreaInsetsContext.Provider value={{ ...insets, top: banner ? 0 : insets.top }}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
