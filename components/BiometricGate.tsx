import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { biometricLogin, getBiometricLabel } from '../lib/biometric';
import { colors } from '../theme';

type Props = {
  /** Called when the user should be dropped to the password login screen. */
  onFallback: () => void;
};

export default function BiometricGate({ onFallback }: Props) {
  const [label, setLabel] = useState('Face ID');
  const [error, setError] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(true);
  const started = useRef(false);
  const retried = useRef(false);

  const runBiometric = useCallback(async () => {
    setError(null);
    setPrompting(true);
    const result = await biometricLogin();
    // On success the auth listener flips `session` and this component unmounts;
    // no navigation needed here. On failure, show retry + password fallback.
    if (!result.success) {
      // Transient "prompt couldn't present" right after a sheet/Modal dismisses
      // (app_cancel / system_cancel) — retry once automatically before showing
      // the fallback. A genuine user cancel or a lockout goes straight to the
      // password path, no scary error.
      const transient =
        result.code === 'app_cancel' || result.code === 'system_cancel';
      if (transient && !retried.current) {
        retried.current = true;
        setTimeout(() => void runBiometric(), 450);
        return;
      }

      setPrompting(false);

      if (result.code === 'user_cancel' || result.code === 'user_fallback') {
        // They explicitly chose the password path — drop them there.
        onFallback();
        return;
      }

      setError(result.error ?? 'Authentication failed. Please sign in with your password.');
    }
  }, [onFallback]);

  // Auto-prompt once when the gate appears, but wait ~450ms so any just-dismissed
  // modal (e.g. the Account Sheet after Log Out) has fully torn down. Presenting
  // Face ID while the previous Modal is still animating out makes iOS return
  // `app_cancel` and the prompt never shows.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = setTimeout(() => void runBiometric(), 450);
    return () => clearTimeout(t);
  }, [runBiometric]);

  useEffect(() => {
    getBiometricLabel()
      .then(setLabel)
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <View className="flex-1 items-center justify-center px-lg">
        {/* Brand */}
        <View className="flex-row items-center gap-sm mb-lg">
          <View className="h-[18px] w-[4px] rounded-full bg-lime" />
          <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
            Dad Health
          </Text>
        </View>

        <View className="h-[84px] w-[84px] rounded-full bg-lime/10 items-center justify-center mb-lg">
          <Feather name="lock" size={34} color={colors.lime} />
        </View>

        <Text className="font-heading text-white text-[34px] leading-[38px] uppercase text-center">
          {`Unlock with ${label}`}
        </Text>
        <Text className="font-body text-muted-text text-[15px] leading-[22px] text-center mt-sm">
          Authenticate to Dad Health
        </Text>

        {prompting ? (
          <ActivityIndicator color={colors.lime} style={{ marginTop: 28 }} />
        ) : (
          <>
            {error ? (
              <Text className="font-body text-[#F87171] text-[14px] leading-[20px] text-center mt-lg">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={runBiometric}
              className="flex-row gap-sm bg-lime rounded-button px-lg py-md items-center justify-center mt-xl active:bg-lime-hover active:opacity-90"
            >
              <Feather name="unlock" size={18} color={colors.dark} />
              <Text className="font-heading-bold text-dark text-[15px] tracking-[1px] uppercase">
                {`Try ${label} again`}
              </Text>
            </Pressable>
          </>
        )}

        {/* Always-available escape hatch to password login. */}
        <Pressable onPress={onFallback} className="mt-lg py-sm active:opacity-70">
          <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
            Use password instead
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
