import React from 'react';
import * as NativeSplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
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
  const { loading, session, onboardingComplete, onboardingLoading, pendingBiometricEnrollment } = useAuth();
  const isOnboarding = onboardingComplete === false;
  const waitingForSession = loading || (session && onboardingLoading);
  return (
    <UpgradeMomentProvider navigationRef={navigationRef}>
    <View className="flex-1" onLayout={hideNativeSplash}>
      {waitingForSession ? <Splash /> : !session ? (
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
    </View>
    </UpgradeMomentProvider>
  );
}
