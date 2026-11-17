import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { requestPushPermission } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import LimeButton from './LimeButton';

const PRE_PERMISSION_KEY = 'dadhealth_push_pre_permission_v1';

function prePermissionKey(userId: string) {
  return `${PRE_PERMISSION_KEY}.${userId}`;
}

export default function PushPrePermissionPrompt({ eligible, onPresentationChange }: { eligible: boolean; onPresentationChange: (shown: boolean) => void }) {
  const { user, onboardingComplete } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = useRef(user?.id); owner.current = user?.id;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    let active = true;
    if (!user?.id || !onboardingComplete || !eligible) {
      setVisible(false);
      return () => { active = false; };
    }
    void SecureStore.getItemAsync(prePermissionKey(user.id)).then((state) => {
      if (active) setVisible(state == null);
    }).catch(() => { if (active) setVisible(false); });
    return () => { active = false; };
  }, [eligible, onboardingComplete, user?.id]);

  useEffect(() => {
    if (visible) onPresentationChange(true);
    else if (Platform.OS !== 'ios') onPresentationChange(false);
  }, [visible, onPresentationChange]);
  const close = () => setVisible(false);
  const decline = async () => {
    const id = user?.id;
    if (!id || busy) return;
    setBusy(true);
    try {
      await SecureStore.setItemAsync(prePermissionKey(id), 'declined');
      if (alive.current && owner.current === id) close();
    } catch { if (alive.current && owner.current === id) setError('Please try again.'); }
    finally { if (alive.current && owner.current === id) setBusy(false); }
  };
  const allow = async () => {
    const id = user?.id;
    if (!id || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await requestPushPermission();
      if (!alive.current || owner.current !== id) return;
      if (!result.configured) { setError('Notifications are unavailable in this version of the app.'); return; }
      if (result.granted) {
  const session = await supabase.auth.getSession();

  if (
    !alive.current ||
    owner.current !== id ||
    session.error ||
    session.data.session?.user.id !== id
  ) {
    return;
  }

  const saved = await supabase
    .from('user_profile')
    .update({ push_notifications_enabled: true })
    .eq('user_id', id)
    .select('user_id')
    .single();

  if (saved.error) throw saved.error;
}

if (!alive.current || owner.current !== id) return;

await SecureStore.setItemAsync(
  prePermissionKey(id),
  result.granted ? 'accepted' : 'declined',
);

if (alive.current && owner.current === id) close();
    } catch { if (alive.current && owner.current === id) setError('Unable to save notification settings. Please try again.'); }
    finally { if (alive.current && owner.current === id) setBusy(false); }
  };

  return (
    <Modal onDismiss={() => onPresentationChange(false)} visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => void decline()}>
      <View className="flex-1 bg-dark px-lg pt-[88px] pb-xl justify-between">
        <View>
          <View className="h-[56px] w-[56px] items-center justify-center rounded-full bg-lime/10 border border-lime/30 mb-xl">
            <Feather name="bell" size={25} color={colors.lime} />
          </View>
          <Text className="font-heading-semibold text-lime text-[13px] tracking-label uppercase mb-sm">Settings</Text>
          <Text className="font-heading text-white text-[42px] leading-[44px] uppercase">Push notifications</Text>
          <Text className="font-body text-white text-[15px] leading-[23px] mt-md">Get a daily check-in reminder and a few timely updates.</Text>
          {error ? <Text accessibilityRole="alert" className="font-body text-white mt-sm">{error}</Text> : null}
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
