import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';
import { crisisServices, outsideUKCopy, openCrisisSupport, type CrisisAction } from '../lib/crisisSupport';

const body = 'font-body text-white text-[16px] leading-[24px]';
export default function CrisisSupportSheet({ onClose }: { onClose(): void }) {
  const [errors, setErrors] = useState<Partial<Record<CrisisAction, string | null>>>({});
  const pending = useRef(new Set<CrisisAction>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function launch(action: CrisisAction) {
    if (pending.current.has(action)) return;
    pending.current.add(action);
    setErrors(previous => ({ ...previous, [action]: null }));
    try {
      const error = await openCrisisSupport(action);
      if (alive.current) setErrors(previous => ({ ...previous, [action]: error }));
    } finally { pending.current.delete(action); }
  }
  const actionButton = (id: CrisisAction, label: string) => <View>
    <Pressable onPress={() => void launch(id)} accessibilityRole="button"
      className="min-h-[48px] justify-center py-sm active:opacity-75">
      <Text className="font-heading-bold text-lime text-[18px] leading-[24px] uppercase">{label}</Text>
    </Pressable>
    {errors[id] ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className={body}>{errors[id]}</Text> : null}
  </View>;
  return <Modal visible transparent animationType={Platform.OS === 'ios' ? 'slide' : 'none'} onRequestClose={onClose}>
    <View className="flex-1 justify-end">
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss urgent help" className="absolute inset-0 bg-black/75" />
      <SafeAreaView edges={['bottom']} style={{ maxHeight: '85%' }} className="rounded-t-[28px] bg-dark px-lg pt-lg" accessibilityViewIsModal>
        <View className="flex-row items-start justify-between gap-md pb-md">
          <Text accessibilityRole="header" className="flex-1 font-heading-bold text-lime text-[24px] leading-[30px] uppercase">Need urgent help?</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close urgent help" className="h-[48px] w-[48px] items-center justify-center rounded-full bg-muted">
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="gap-lg pb-xl">
          <Text className={body}>UK support. Choose a service below. Calls and texts only start when you choose an action.</Text>
          {crisisServices.map(service => <View key={service.id} className="gap-xs border-b border-border pb-md">
            <Text accessibilityRole="header" className="font-heading-bold text-white text-[22px] leading-[26px] uppercase">{service.name}</Text>
            <Text className={body}>{service.detail}</Text>
            {actionButton(service.id, service.action)}
          </View>)}
          <View className="gap-xs">
            <Text className={body}>{outsideUKCopy}</Text>
            {actionButton('local', 'Outside the UK? Find local support')}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
