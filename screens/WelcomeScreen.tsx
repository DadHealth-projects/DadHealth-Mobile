import React from 'react';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import FadeInView from '../components/FadeInView';
import LimeButton from '../components/LimeButton';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Navigation = NativeStackNavigationProp<AppStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<Navigation>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <View className="flex-1 px-lg pt-xl pb-xl justify-between">
        <FadeInView>
          <Image
            source={require('../assets/LOGO.png')}
            resizeMode="contain"
            accessibilityLabel="Dad Health"
            className="w-full h-[156px]"
          />
        </FadeInView>

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
