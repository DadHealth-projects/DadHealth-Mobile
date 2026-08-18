import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { disableBiometricLogin, getBiometricLabel, hasBiometricCredentials, isBiometricAvailable } from '../../lib/biometric';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

export default function PrivacySecurityScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { session, user, resetPassword } = useAuth();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([isBiometricAvailable(), hasBiometricCredentials(), getBiometricLabel()]).then(([available, enabled, label]) => {
      if (!active) return;
      setBiometricAvailable(available);
      setBiometricEnabled(enabled);
      setBiometricLabel(label);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const disableBiometric = useCallback(() => {
    Alert.alert(`Turn off ${biometricLabel}?`, 'You will need your password the next time you log in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Turn off', style: 'destructive', onPress: () => void (async () => {
        if (!session?.access_token) {
          setMessage(`Your session ended before ${biometricLabel} login could be turned off. Sign in again and retry.`);
          return;
        }
        try {
          const result = await disableBiometricLogin(session.access_token);
          if (result.success) {
            setBiometricEnabled(false);
            setMessage(`${biometricLabel} login turned off.`);
          } else {
            setMessage(result.error ?? `${biometricLabel} login could not be turned off. Please try again.`);
          }
        } catch {
          setMessage(`${biometricLabel} login could not be turned off. Please try again.`);
        }
      })() },
    ]);
  }, [biometricLabel, session?.access_token]);

  const sendReset = useCallback(() => {
    if (!user?.email) { setMessage('Your account email is unavailable.'); return; }
    Alert.alert('Reset password?', `We will email a secure reset link to ${user.email}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send link', onPress: () => void resetPassword(user.email!).then(({ error }) => setMessage(error ?? 'Check your inbox for a password reset link.')) },
    ]);
  }, [resetPassword, user?.email]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close privacy and security" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="Settings" headline={'Privacy &\nsecurity'} />

        {!user ? (
          <Pressable onPress={() => navigation.navigate('Login')} accessibilityRole="button" className="min-h-[48px] justify-center border-y border-border"><Text className="font-heading-bold text-lime text-[12px] uppercase">Log in to continue</Text></Pressable>
        ) : loading ? (
          <View className="gap-sm"><View className="h-[82px] bg-white/5" /><View className="h-[68px] bg-white/5" /></View>
        ) : (
          <View className="border-t border-border">
            <View className="min-h-[82px] flex-row items-center gap-md border-b border-border py-md">
              <View className="h-[36px] w-[36px] items-center justify-center"><Feather name={biometricEnabled ? 'unlock' : 'lock'} size={19} color={colors.lime} /></View>
              <View className="flex-1"><Text className="font-heading-bold text-white text-[14px] uppercase">{biometricLabel} login</Text><Text className="font-body text-muted-text text-[11px] leading-[17px] mt-xs">{!biometricAvailable ? 'Biometric login is not available on this device.' : biometricEnabled ? `Unlock Dad Health with ${biometricLabel}.` : `Sign in with your password once to enable ${biometricLabel}.`}</Text></View>
              {biometricEnabled ? <Pressable onPress={disableBiometric} accessibilityRole="button" className="min-h-[40px] justify-center border-b border-red-300"><Text className="font-heading-bold text-red-300 text-[10px] uppercase">Turn off</Text></Pressable> : <Text className="font-heading-bold text-tertiary-text text-[10px] uppercase">Off</Text>}
            </View>

            <Pressable onPress={sendReset} accessibilityRole="button" className="min-h-[68px] flex-row items-center gap-md border-b border-border active:opacity-70">
              <View className="h-[36px] w-[36px] items-center justify-center"><Feather name="key" size={19} color={colors.lime} /></View>
              <View className="flex-1"><Text className="font-heading-bold text-white text-[14px] uppercase">Reset password</Text><Text className="font-body text-muted-text text-[11px] mt-xs" numberOfLines={1}>{user.email}</Text></View>
              <Feather name="chevron-right" size={18} color={colors.lime} />
            </Pressable>
          </View>
        )}

        {message ? <Text accessibilityRole="alert" className="font-body text-tertiary-text text-[12px]">{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
