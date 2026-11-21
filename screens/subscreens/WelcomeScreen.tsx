import React from 'react';
import AnalyticsConsentControl from '../../components/AnalyticsConsentControl';
import { useAnalyticsPresentation } from '../../hooks/useAnalyticsPresentation';
import { useAuth } from '../../contexts/AuthContext';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { trackEvent } from '../../lib/analytics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import FadeInView from '../../components/FadeInView';
import LimeButton from '../../components/LimeButton';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Navigation = NativeStackNavigationProp<AppStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const { user, onboardingComplete } = useAuth();
  const presented = useAnalyticsPresentation(user?.id, 'onboarding_started', {}, onboardingComplete === false);
  const navigation = useNavigation<Navigation>();
  const focused = useIsFocused();

  return (
    <SafeAreaView onLayout={presented} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView contentContainerClassName="px-lg pt-xl pb-lg gap-lg">
        <FadeInView delay={120}>
          <Text className="font-heading-semibold text-lime text-[13px] tracking-label uppercase mb-md">
            Built for the everyday
          </Text>
          <Text className="font-heading text-white text-[44px] leading-[46px] uppercase">
            A healthier life, with your kids at the heart of it.
          </Text>
          <Text className="font-body text-muted-text text-[16px] leading-[24px] mt-md">
            A few quick questions will tailor Dad Health to your life.
          </Text>
        </FadeInView>

          <AnalyticsConsentControl key={user?.id} owner={user?.id} card onGranted={() => {
            // This presentation is still occurring after explicit consent, not a replay.
            if (focused && onboardingComplete === false) trackEvent('onboarding_started', {}, user?.id);
          }} />
      </ScrollView>
      <View className="px-lg pb-lg pt-sm">
        <FadeInView delay={220}>
          <View className="flex-row gap-xs mb-lg">
            <View className="h-[6px] flex-1 rounded-full bg-lime" />
            <View className="h-[6px] flex-1 rounded-full bg-border" />
            <View className="h-[6px] flex-1 rounded-full bg-border" />
          </View>
          <LimeButton label="Continue" onPress={() => navigation.navigate('OnboardingGoals')} />
        </FadeInView>
      </View>
    </SafeAreaView>
  );
}
