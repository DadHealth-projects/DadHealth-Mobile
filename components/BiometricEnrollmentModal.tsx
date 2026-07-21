import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { getBiometricLabel } from '../lib/biometric';
import { colors } from '../theme';

export default function BiometricEnrollmentModal() {
  const { pendingBiometricEnrollment, completeBiometricEnrollment } = useAuth();
  const [label, setLabel] = useState('Face ID');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
  let mounted = true;

  getBiometricLabel()
    .then((value) => {
      if (mounted) {
        setLabel(value);
      }
    })
    .catch(() => {});

  return () => {
    mounted = false;
  };
}, []);

  const visible = !!pendingBiometricEnrollment;

  const resolve = async (enable: boolean) => {
  if (busy) return;

  setBusy(true);

  try {
    await completeBiometricEnrollment(enable);
  } finally {
    setBusy(false);
  }
};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => resolve(false)}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-lg">
        <View className="w-full rounded-card bg-card border border-border p-lg">
          <View className="h-[64px] w-[64px] rounded-full bg-lime/10 items-center justify-center self-center mb-md">
            <Feather name="unlock" size={28} color={colors.lime} />
          </View>

          <Text className="font-heading text-white text-[28px] leading-[32px] uppercase text-center">
            {`Use ${label} to sign in next time?`}
          </Text>
          <Text className="font-body text-muted-text text-[15px] leading-[22px] text-center mt-sm">
            {`Skip typing your password — unlock Dad Health with ${label}. You can turn this off anytime in Profile.`}
          </Text>

          <Pressable
            onPress={() => resolve(true)}
            disabled={busy}
            className="bg-lime rounded-button px-lg py-md items-center justify-center mt-lg active:bg-lime-hover active:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text className="font-heading-bold text-dark text-[15px] tracking-[1px] uppercase">
                {`Enable ${label}`}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => resolve(false)}
            disabled={busy}
            className="px-lg py-md items-center justify-center mt-sm active:opacity-70 disabled:opacity-60"
          >
            <Text className="font-heading-semibold text-muted-text text-[14px] tracking-[0.5px] uppercase">
              Not Now
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
