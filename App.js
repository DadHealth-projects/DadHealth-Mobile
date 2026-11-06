import './global.css';

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';

import { AuthProvider } from './contexts/AuthContext';
import { NetworkProvider } from './contexts/NetworkContext';
import RootNavigator from './contexts/RootNavigator';
import { colors } from './theme';
import OneSignalManager from './components/OneSignalManager';
import AppleHealthManager from './components/AppleHealthManager';
import HealthConnectManager from './components/HealthConnectManager';
import PushPrePermissionPrompt from './components/PushPrePermissionPrompt';
import Splash from './components/Splash';
import OfflineSyncManager from './components/OfflineSyncManager';
import GlobalConnectivityToast from './components/GlobalConnectivityToast';
import OfflineStatusBanner from './components/OfflineStatusBanner';
import { attachPushNavigation } from './lib/pushNotifications';
import { deepLinkingOptions } from './lib/deepLinks';

const navigationRef = createNavigationContainerRef();

// Force the dark background through React Navigation's own theme so there's
// no white flash between screens.
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.dark,
    card: colors.dark,
    text: colors.text,
    primary: colors.lime,
    border: colors.border,
  },
};

export default function App() {
  const [fontLoadAttempt, setFontLoadAttempt] = useState(0);
  const retryFontLoad = () => setFontLoadAttempt((attempt) => attempt + 1);

  return (
    <FontLoadingGate
      key={fontLoadAttempt}
      onRetry={retryFontLoad}
    />
  );
}

function FontLoadingGate({ onRetry }) {
  // Map @expo-google-fonts modules to the family names used in tailwind.config.js / theme.ts.
  const [fontsLoaded, fontError] = useFonts({
    'Barlow-Regular': Barlow_400Regular,
    'Barlow-Medium': Barlow_500Medium,
    'Barlow-SemiBold': Barlow_600SemiBold,
    'BarlowCondensed-SemiBold': BarlowCondensed_600SemiBold,
    'BarlowCondensed-Bold': BarlowCondensed_700Bold,
    'BarlowCondensed-ExtraBold': BarlowCondensed_800ExtraBold,
  });

  if (fontError) {
    return <FontLoadingFailure onRetry={onRetry} />;
  }

  // Keep the branded loading surface visible until fonts are ready.
  if (!fontsLoaded) {
    return <Splash />;
  }

  return <AppContent />;
}

function FontLoadingFailure({ onRetry }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <Splash />
      <View
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 40,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.text, fontSize: 15, textAlign: 'center' }}>
          Dad Health couldn&apos;t load its fonts. Try again to continue.
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="mt-md min-h-[48px] min-w-[140px] items-center justify-center rounded-button bg-lime px-lg"
        >
          <Text style={{ color: colors.dark, fontSize: 16, fontWeight: '700' }}>
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AppContent() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <OfflineSyncManager />
          <OfflineStatusBanner>
            <NavigationContainer
              ref={navigationRef}
              onReady={() => attachPushNavigation(navigationRef)}
              theme={navTheme}
              linking={deepLinkingOptions}
            >
              <StatusBar style="light" />
              <OneSignalManager />
              <AppleHealthManager />
              <HealthConnectManager />
              <RootNavigator navigationRef={navigationRef} />
              <PushPrePermissionPrompt />
            </NavigationContainer>
          </OfflineStatusBanner>
          <GlobalConnectivityToast />
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
