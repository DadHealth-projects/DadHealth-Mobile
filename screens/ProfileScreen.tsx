import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/Card';
import FadeInView from '../components/FadeInView';
import { useAuth } from '../contexts/AuthContext';
import {
  clearBiometricCredentials,
  getBiometricLabel,
  hasBiometricCredentials,
  isBiometricAvailable,
} from '../lib/biometric';
import { colors } from '../theme';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://dadhealth.co.uk';

/**
 * Profile — reached from the Account Sheet's "My Profile" row (not a bottom tab,
 * no longer opened directly from the avatar). Shows account identity + device
 * settings only. Log Out now lives in the Account Sheet, not here.
 */
export default function ProfileScreen() {
  const { session, user } = useAuth();
  const navigation = useNavigation<{ navigate: (screen: 'Login') => void; goBack: () => void }>();

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioLabel, setBioLabel] = useState('Face ID');

  useEffect(() => {
    let active = true;
    (async () => {
      const [available, enrolled, label] = await Promise.all([
        isBiometricAvailable(),
        hasBiometricCredentials(),
        getBiometricLabel(),
      ]);
      if (!active) return;
      setBioAvailable(available);
      setBioEnrolled(enrolled);
      setBioLabel(label);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleDisableBiometric = async () => {
    await clearBiometricCredentials();
    setBioEnrolled(false);
  };

  const openWebDashboard = () => {
    Linking.openURL(`${WEB_URL}/progress`).catch(() => {
      /* no-op if no browser can handle it */
    });
  };

  const email = user?.email ?? '—';
  const initial = (user?.email?.[0] ?? '?').toUpperCase();

  if (!session) {
  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.dark }}
    >
      <ScrollView
        contentContainerClassName="px-lg pt-xl pb-[120px] gap-lg"
      >
        {/* Close */}
        <View className="flex-row justify-end">
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-[40px] w-[40px] rounded-full border border-border items-center justify-center"
          >
            <Feather
              name="x"
              size={20}
              color={colors.text}
            />
          </Pressable>
        </View>

        <FadeInView>
          <View className="flex-row items-center gap-sm mb-md">
            <View className="h-[18px] w-[4px] rounded-full bg-lime" />
            <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
              Account
            </Text>
          </View>

          <Text className="font-heading text-white text-[46px] leading-[48px] uppercase">
            Profile
          </Text>

          <Text className="font-body text-muted-text text-[16px] mt-lg">
            You're not signed in.
          </Text>
        </FadeInView>

        <Pressable
          onPress={() => { navigation.goBack();
    requestAnimationFrame(() => {
      navigation.navigate('Login');
    }); 
  }}
          className="bg-lime rounded-button px-lg py-md items-center justify-center mt-xl"
        >
          <Text className="font-heading-bold text-dark text-[15px] uppercase tracking-[1px]">
            Sign In
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-xl pb-[120px] gap-lg"
      >
        {/* Close (modal) */}
        <View className="flex-row justify-end">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            className="h-[40px] w-[40px] rounded-full border border-border items-center justify-center active:opacity-70"
          >
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
        </View>

        <FadeInView>
          <View className="flex-row items-center gap-sm mb-md">
            <View className="h-[18px] w-[4px] rounded-full bg-lime" />
            <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
              Account
            </Text>
          </View>
          <Text className="font-heading text-white text-[46px] leading-[48px] uppercase">
            Profile
          </Text>
        </FadeInView>

        {/* Identity card */}
        <FadeInView delay={120}>
          <Card className="flex-row items-center gap-md">
            <View className="h-[54px] w-[54px] rounded-full bg-lime items-center justify-center">
              <Text className="font-heading-bold text-dark text-[24px]">{initial}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-heading-semibold text-muted-text text-[11px] tracking-label uppercase">
                Signed in as
              </Text>
              <Text className="font-body-semibold text-white text-[16px] mt-xs" numberOfLines={1}>
                {email}
              </Text>
            </View>
          </Card>
        </FadeInView>

        {/* Settings */}
        <FadeInView delay={210}>
          <Text className="font-heading-semibold text-muted-text text-[12px] tracking-label uppercase mb-sm">
            Settings
          </Text>

          {/* Biometric login control */}
          {bioAvailable ? (
            <Card className="flex-row items-center gap-md mb-md">
              <View className="h-[46px] w-[46px] rounded-button bg-lime/10 items-center justify-center">
                <Feather name={bioEnrolled ? 'unlock' : 'lock'} size={22} color={colors.lime} />
              </View>
              <View className="flex-1">
                <Text className="font-heading-bold text-white text-[18px] uppercase tracking-[0.5px]">
                  {`${bioLabel} Login`}
                </Text>
                <Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">
                  {bioEnrolled
                    ? `Unlock Dad Health with ${bioLabel}.`
                    : `Sign in with your password to enable ${bioLabel}.`}
                </Text>
              </View>
              {bioEnrolled ? (
                <Pressable
                  onPress={handleDisableBiometric}
                  className="border border-border rounded-button px-md py-sm active:bg-muted/40"
                >
                  <Text className="font-heading-semibold text-white text-[12px] tracking-[0.5px] uppercase">
                    Turn Off
                  </Text>
                </Pressable>
              ) : (
                <Text className="font-heading-semibold text-tertiary-text text-[12px] tracking-label uppercase">
                  Off
                </Text>
              )}
            </Card>
          ) : null}

          {/* Web dashboard link */}
          <Pressable onPress={openWebDashboard} className="active:opacity-80">
            <Card className="flex-row items-center gap-md">
              <View className="h-[46px] w-[46px] rounded-button bg-lime/10 items-center justify-center">
                <Feather name="external-link" size={22} color={colors.lime} />
              </View>
              <View className="flex-1">
                <Text className="font-heading-bold text-white text-[18px] uppercase tracking-[0.5px]">
                  Open Web Dashboard
                </Text>
                <Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">
                  View your full progress and settings on the web.
                </Text>
              </View>
              <Feather name="chevron-right" size={22} color={colors.tertiaryText} />
            </Card>
          </Pressable>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}
