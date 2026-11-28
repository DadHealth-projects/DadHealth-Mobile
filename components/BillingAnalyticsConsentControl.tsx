import React, { useCallback, useRef, useState } from 'react';
import { AppState, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { requestBillingChoice, type BillingAnalyticsChoice, type BillingAnalyticsChange } from '../lib/billingAnalyticsConsent';
import { colors } from '../theme';

export default function BillingAnalyticsConsentControl({ owner }: { owner: string }) {
  const [state, setState] = useState<{ choice: BillingAnalyticsChoice | null; busy: boolean; error: string }>({ choice: null, busy: true, error: '' });
  const current = useRef(owner); current.current = owner;
  const active = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const sequence = useRef(0);
  const pending = useRef<{ owner: string; change: BillingAnalyticsChange } | null>(null);
  const read = useCallback(async (signal: AbortSignal) => {
    const request = ++sequence.current;
    try {
      const choice = await requestBillingChoice(owner, signal);
      if (signal.aborted || current.current !== owner || request !== sequence.current) return;
      const uncertain = pending.current?.owner === owner ? pending.current.change : null;
      // A newer revision is authoritative, even if another device changed it.
      const unresolved = uncertain && choice.revision <= uncertain.revision;
      if (!unresolved) pending.current = null;
      setState({ choice, busy: false, error: unresolved ? 'We couldn’t confirm your choice yet.' : '' });
    } catch {
      if (!signal.aborted && current.current === owner && request === sequence.current) setState(s => ({ ...s, busy: false, error: 'We couldn’t confirm your choice yet.' }));
    }
  }, [owner]);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController(); active.current = controller;
    if (pending.current?.owner !== owner) pending.current = null;
    void read(controller.signal);
    const sub = AppState.addEventListener('change', value => {
      if (value === 'active' && !writing.current) void read(controller.signal);
    });
    return () => { controller.abort(); sub.remove(); };
  }, [owner, read]));
  async function change(granted: boolean) {
    const choice = state.choice, controller = active.current;
    if (writing.current || !choice || choice.owner !== owner || !controller || controller.signal.aborted) return;
    const uncertain = pending.current?.owner === owner ? pending.current.change : null;
    if (uncertain && uncertain.granted !== granted && granted) return;
    writing.current = true;
    sequence.current++; // A read started before this write cannot overwrite it.
    // Another explicit tap repeats the SAME uncertain operation, never a new grant.
    const mutation = uncertain?.granted === granted
      ? uncertain
      : { granted, revision: choice.revision, operationId: Crypto.randomUUID() };
    pending.current = { owner, change: mutation };
    setState(s => ({ ...s, busy: true, error: '' }));
    try {
      const saved = await requestBillingChoice(owner, controller.signal, mutation);
      if (!controller.signal.aborted && current.current === owner) {
        if (saved.operationId !== mutation.operationId || saved.granted !== granted) throw new Error('Unconfirmed');
        pending.current = null;
        setState({ choice: saved, busy: false, error: '' });
      }
    } catch {
      if (!controller.signal.aborted && current.current === owner) await read(controller.signal);
    } finally { writing.current = false; }
  }
  const owned = state.choice?.owner === owner;
  return <View className="gap-sm py-md">
    <View className="flex-row items-center gap-md min-h-[48px]">
      <Text className="flex-1 font-heading-bold text-white text-[20px] uppercase">Share subscription analytics</Text>
      <Switch accessibilityLabel="Share subscription analytics" value={owned && (state.choice!.granted ||
          pending.current?.change.granted === true)}
        disabled={!owned || state.busy} onValueChange={value => void change(value)} trackColor={{ true: colors.lime }} />
    </View>
    <Text className="font-body text-white text-[14px] leading-[20px]">Optional: share verified trial starts, paid trial conversions and renewal cancellations for this account, even while the app is closed. This is separate from app usage analytics. Turning it off stops future collection; it doesn’t cancel your subscription or erase information already shared.</Text>
  </View>;
}
