import React, { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import FadeInView from '../../components/FadeInView';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { session, signOut } = useAuth();

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need to log in again to access your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [signOut]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <AppTopBar
          leftAccessory={
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close settings" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70">
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          }
        />

        <FadeInView>
          <ScreenHero eyebrow="Settings" headline={'Your\npreferences'} />
        </FadeInView>

        <FadeInView delay={80}>
          <View className="border-t border-border">
            <SettingsRow icon="user" label="Account" onPress={() => navigation.navigate('Profile')} />
            <SettingsRow icon="bell" label="Push notifications" onPress={() => navigation.navigate('NotificationSettings')} />
            <SettingsRow icon="lock" label="Privacy & security" onPress={() => navigation.navigate('PrivacySecurity')} />
            <SettingsRow icon="heart" label="Health permissions" future />
            <SettingsRow icon="moon" label="Appearance" future />
            <SettingsRow icon="file-text" label="Terms & privacy" onPress={() => navigation.navigate('TermsPrivacy')} />
          </View>
        </FadeInView>

        {session ? (
          <FadeInView delay={130}>
            <Pressable onPress={confirmSignOut} accessibilityRole="button" className="min-h-[54px] flex-row items-center gap-md border-y border-red-400/25 active:opacity-70">
              <Feather name="log-out" size={18} color="#FCA5A5" />
              <Text className="font-heading-bold text-red-300 text-[13px] uppercase">Sign out</Text>
            </Pressable>
          </FadeInView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({ icon, label, onPress, pending = false, future = false }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress?: () => void; pending?: boolean; future?: boolean }) {
  const disabled = !onPress;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} className="min-h-[62px] flex-row items-center gap-md border-b border-border active:opacity-70">
      <View className="h-[34px] w-[34px] items-center justify-center">
        <Feather name={icon} size={18} color={disabled ? colors.tertiaryText : colors.lime} />
      </View>
      <Text className={`flex-1 font-heading-bold text-[14px] uppercase ${disabled ? 'text-muted-text' : 'text-white'}`}>{label}</Text>
      {future ? <Text className="font-heading-bold text-white/25 text-[9px] uppercase">Future</Text> : pending ? <Text className="font-heading-bold text-white/25 text-[9px] uppercase">Pending</Text> : <Feather name="chevron-right" size={18} color={colors.lime} />}
    </Pressable>
  );
}
