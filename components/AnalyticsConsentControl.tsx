import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { getAnalyticsConsentStatus, setAnalyticsConsent } from '../lib/analytics';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

/** Consent belongs to this account on this device, never to the next login. */
export default function AnalyticsConsentControl({ owner, onGranted, card = false }: { owner: string | undefined; onGranted?: () => void; card?: boolean }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const [state, setState] = useState({ owner, granted: false, busy: true, error: '' });
  const current = useRef(owner); current.current = owner;
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    let alive = true;
    mounted.current = true;
    setState({ owner, granted: false, busy: true, error: '' });
    void getAnalyticsConsentStatus(owner ?? null).then(({ granted, ready }) => {
      if (alive && current.current === owner) setState({ owner, granted, busy: false, error: granted && !ready ? 'We couldn’t turn this on right now. Please try again later.' : '' });
    }).catch(() => {
      if (alive && current.current === owner) setState({ owner, granted: false, busy: false, error: 'We couldn’t read your analytics choice.' });
    });
    return () => { alive = false; mounted.current = false; };
  }, [owner]);
  async function change(granted: boolean) {
    if (lock.current) return;
    lock.current = true;
    setState(s => ({ ...s, busy: true, error: '' }));
    try {
      await setAnalyticsConsent(owner ?? null, granted ? 'granted' : 'denied');
      const { granted: saved, ready } = await getAnalyticsConsentStatus(owner ?? null);
      if (mounted.current && current.current === owner) setState({ owner, granted: saved, busy: false,
        error: saved === granted ? saved && !ready ? 'We couldn’t turn this on right now. Please try again later.' : '' : 'We couldn’t save your analytics choice.' });
      if (mounted.current && current.current === owner && granted && saved && ready) onGranted?.();
    } catch {
      if (mounted.current && current.current === owner) setState(s => ({ ...s, busy: false, error: 'We couldn’t save your analytics choice.' }));
    } finally { lock.current = false; }
  }
  return <View className={card ? "gap-sm rounded-card border border-border bg-card p-md" : "gap-sm py-md"}>
    <View className="flex-row items-center gap-md min-h-[48px]">
      <Text className="flex-1 font-heading-bold text-white text-[20px] uppercase">Help improve Dad Health</Text>
      <Switch accessibilityLabel="Help improve Dad Health" value={state.owner === owner && state.granted}
        disabled={state.owner !== owner || state.busy} onValueChange={value => void change(value)} trackColor={{ true: colors.lime }} />
    </View>
    <Text className="font-body text-white text-[14px] leading-[20px]">Allow optional usage analytics to help us improve the app. We don’t include your Journal entries or other written content.</Text>
    <Pressable accessibilityRole="link" onPress={() => navigation.navigate('TermsPrivacy')} className="min-h-[48px] justify-center">
      <Text className="font-body text-lime text-[14px] underline">Privacy policy</Text>
    </Pressable>
    {state.owner === owner && state.error ? <Text accessibilityRole="alert" className="font-body text-white text-[14px]">{state.error}</Text> : null}
  </View>;
}
