import { MindResetProvider } from './MindResetContext';
import MindResetControls from '../components/MindResetControls';
import React from 'react';
import * as NativeSplashScreen from 'expo-splash-screen';
import { Text, View } from 'react-native';
import LimeButton from '../components/LimeButton';
import type { NavigationContainerRef } from '@react-navigation/native';

import { useAuth } from './AuthContext';
import AppNavigator, { type AppStackParamList } from '../navigation/AppNavigator';
import BiometricEnrollmentModal from '../components/BiometricEnrollmentModal';
import DeepLinkManager from '../components/DeepLinkManager';
import Splash from '../components/Splash';
import { UpgradeMomentProvider } from './UpgradeMomentContext';

let nativeSplashHidden = false;
function hideNativeSplash() {
  if (nativeSplashHidden) return;
  nativeSplashHidden = true;
  void NativeSplashScreen.hideAsync().catch(() => undefined);
}

export default function RootNavigator({
  navigationRef,
}: {
  navigationRef: NavigationContainerRef<AppStackParamList>;
}) {
    const {
    loading,
    session,
    onboardingComplete,
    onboardingLoading,
    pendingBiometricEnrollment,
    refreshOnboarding,
  } = useAuth();
  const isOnboarding = onboardingComplete === false;
  const waitingForSession = loading || (session && onboardingLoading);
  return (
    <UpgradeMomentProvider navigationRef={navigationRef}>
    <MindResetProvider key={session?.user.id ?? 'signed-out'} owner={session?.user.id}>
    <View className="flex-1" onLayout={hideNativeSplash}>
            {waitingForSession ? <Splash /> : session && onboardingComplete === null ? (
        <View className="flex-1 bg-dark px-lg items-center justify-center gap-lg">
          <Text
            accessibilityRole="alert"
            className="font-body text-white text-[16px] leading-[24px] text-center"
          >
            We couldn’t load your setup progress. Check your connection and try again.
          </Text>
          <LimeButton
            label="Try again"
            onPress={() => void refreshOnboarding()}
          />
        </View>
      ) : !session ? (
        <>
          <AppNavigator key="tabs" initialRouteName="Tabs" />
          <DeepLinkManager navigationRef={navigationRef} />
        </>
      ) : (
        <>
          <AppNavigator
            key={isOnboarding ? 'onboarding' : 'tabs'}
            initialRouteName={isOnboarding ? 'Welcome' : 'Tabs'}
          />
          <DeepLinkManager navigationRef={navigationRef} />

          {pendingBiometricEnrollment && <BiometricEnrollmentModal />}
        </>
      )}
      {session && !waitingForSession && onboardingComplete === true ? <MindResetControls navigationRef={navigationRef} /> : null}
    </View>
    </MindResetProvider>
    </UpgradeMomentProvider>
  );
}
