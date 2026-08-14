import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { requestPushPermission } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import LimeButton from './LimeButton';

const PRE_PERMISSION_KEY = 'dadhealth_push_pre_permission_v1';

export default function PushPrePermissionPrompt() {
  const { user, onboardingComplete } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id || !onboardingComplete) {
      setVisible(false);
      return () => { active = false; };
    }
    void SecureStore.getItemAsync(`${PRE_PERMISSION_KEY}:${user.id}`).then((state) => {
      if (active) setVisible(state == null);
    });
    return () => { active = false; };
  }, [onboardingComplete, user?.id]);

  const decline = async () => {
    if (user?.id) await SecureStore.setItemAsync(`${PRE_PERMISSION_KEY}:${user.id}`, 'declined');
    setVisible(false);
  };

  const allow = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    const result = await requestPushPermission();
    await SecureStore.setItemAsync(`${PRE_PERMISSION_KEY}:${user.id}`, result.granted ? 'accepted' : 'declined');
    if (result.granted) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await supabase.from('user_profile').update({ push_notifications_enabled: true, timezone }).eq('user_id', user.id);
    }
    setBusy(false);
    setVisible(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => void decline()}>
      <View className="flex-1 bg-dark px-lg pt-[88px] pb-xl justify-between">
        <View>
          <View className="h-[56px] w-[56px] items-center justify-center rounded-full bg-lime/10 border border-lime/30 mb-xl">
            <Feather name="bell" size={25} color={colors.lime} />
          </View>
          <Text className="font-heading-semibold text-lime text-[13px] tracking-label uppercase mb-sm">Settings</Text>
          <Text className="font-heading text-white text-[42px] leading-[44px] uppercase">Push notifications</Text>
          <Text className="font-body text-muted-text text-[15px] leading-[23px] mt-md">All notifications are opt-in. Times are based on your dad timezone.</Text>
          <Text className="font-body text-muted-text text-[13px] leading-[20px] mt-lg">Daily check-in: Good morning. How are you feeling today?</Text>
          <Text className="font-body text-muted-text text-[13px] leading-[20px] mt-sm">Streak at risk: Your streak ends at midnight.</Text>
        </View>
        <View className="gap-md">
          <LimeButton label="Allow notifications" onPress={() => void allow()} loading={busy} />
          <Pressable onPress={() => void decline()} disabled={busy} className="min-h-[48px] items-center justify-center">
            <Text className="font-heading-bold text-tertiary-text text-[11px] uppercase">Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
