import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useAppleHealth } from '../../hooks/useAppleHealth';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const DATA_TYPES = [
  ['activity', 'Steps', 'Your daily step total.'],
  ['clock', 'Active minutes', 'Apple Exercise Time from each day.'],
  ['heart', 'Resting heart rate', 'Your daily resting heart-rate estimate.'],
  ['moon', 'Sleep', 'Time Apple Health records as asleep.'],
] as const;

export default function HealthPermissionsScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const health = useAppleHealth(user?.id);
  const [message, setMessage] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setMessage(null);
    const result = await health.connect();
    if (result) setMessage('Apple Health connected.');
  }, [health.connect]);

  const sync = useCallback(async () => {
    setMessage(null);
    const result = await health.sync();
    if (result) setMessage('Apple Health data synced.');
  }, [health.sync]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <AppTopBar
          leftAccessory={(
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close health permissions" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70">
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          )}
        />

        <ScreenHero eyebrow="Settings" headline={'Health\npermissions'} sub="Connect Apple Health to keep your existing Fitness and Progress data up to date." />

        <View className="border-t border-border">
          {DATA_TYPES.map(([icon, title, description]) => (
            <View key={title} className="min-h-[68px] flex-row items-center gap-md border-b border-border py-md">
              <View className="h-[34px] w-[34px] items-center justify-center">
                <Feather name={icon} size={18} color={colors.lime} />
              </View>
              <View className="flex-1">
                <Text className="font-heading-bold text-white text-[13px] uppercase">{title}</Text>
                <Text className="font-body text-muted-text text-[11px] leading-[17px] mt-xs">{description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="gap-md border-y border-border py-lg">
          {!user ? (
            <LimeButton label="Log in to connect" onPress={() => navigation.navigate('Login')} />
          ) : health.loading ? (
            <View className="h-[48px] bg-white/5" />
          ) : health.integration && health.authorization === 'ready' ? (
            <>
              <View className="flex-row items-center justify-between gap-md">
                <View className="flex-1">
                  <Text className="font-heading-bold text-lime text-[12px] uppercase">Apple Health connected</Text>
                  <Text className="font-body text-muted-text text-[11px] leading-[17px] mt-xs">You can change what Dad Health can access anytime in Apple Health or iPhone Settings.</Text>
                  <Text className="font-body text-tertiary-text text-[11px] mt-xs">{formatLastSync(health.integration.last_sync_at)}</Text>
                </View>
                <Feather name="check-circle" size={20} color={colors.lime} />
              </View>
              <LimeButton label={health.saving ? 'Syncing...' : 'Sync now'} onPress={() => void sync()} disabled={health.saving} />
              <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button" className="min-h-[44px] self-start justify-center border-b border-lime active:opacity-70">
                <Text className="font-heading-bold text-lime text-[11px] uppercase">Manage in Apple settings</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="font-heading-bold text-white text-[13px] uppercase">Connect Apple Health</Text>
              <Text className="font-body text-muted-text text-[12px] leading-[19px]">Allow Dad Health to read your health data so your Fitness and Progress screens stay up to date automatically.</Text>
              <LimeButton
                label={health.saving ? 'Connecting...' : 'Connect Apple Health'}
                onPress={() => void connect()}
                disabled={health.saving || health.capability !== 'available'}
              />
              {health.capability !== 'available' ? (
                <Text className="font-body text-muted-text text-[12px] leading-[19px]">Apple Health isn’t available on this device.</Text>
              ) : null}
            </>
          )}
        </View>

        {health.error ? <Text accessibilityRole="alert" className="font-body text-red-300 text-[12px] leading-[18px]">{health.error}</Text> : null}
        {message ? <Text accessibilityRole="alert" className="font-body text-lime text-[12px] leading-[18px]">{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatLastSync(value: string | null) {
  if (!value) return 'First sync pending.';
  const date = new Date(value);
  return `Last synced ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
}
