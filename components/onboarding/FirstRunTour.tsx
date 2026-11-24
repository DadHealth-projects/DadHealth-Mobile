import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import LimeButton from '../LimeButton';
import { colors } from '../../theme';

/**
 * Brief 06: a short first-run tour (3 screens at most) that ends on the first
 * daily check-in. No paywall, skippable at every step. Copy is the proposal sent
 * to the client and is kept here so it can be revised in one place.
 */
export const FIRST_RUN_TOUR_STEPS = [
  {
    eyebrow: 'Your score',
    title: 'Your Dad Health Score',
    body: 'One number out of 100 that shows how you are doing this week. It grows from small daily actions, so every check-in, workout and moment with your kids counts.',
  },
  {
    eyebrow: 'Three pillars',
    title: 'Body, Mind and Bond',
    body: 'Body is moving and resting well. Mind is a few minutes to reset or reflect. Bond is time with your kids, in person or from afar. Your score brings all three together.',
  },
  {
    eyebrow: 'Get started',
    title: 'Your first check-in',
    body: 'It takes a few seconds: how you feel, your energy, your connection and your sleep. Check in each day to build your streak.',
  },
] as const;

export default function FirstRunTour({ visible, onFinish, onShow, onDismiss }: {
  visible: boolean;
  /** startCheckIn is true only when the dad chose to start his check-in from the last step. */
  onFinish: (startCheckIn: boolean) => void;
  onShow?: () => void;
  onDismiss?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = FIRST_RUN_TOUR_STEPS[index];
  const last = index === FIRST_RUN_TOUR_STEPS.length - 1;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => onFinish(false)} onShow={onShow} onDismiss={onDismiss}>
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.dark }}>
          <View className="flex-row justify-end px-lg pt-sm">
            <Pressable onPress={() => onFinish(false)} accessibilityRole="button" accessibilityLabel="Skip the introduction" className="min-h-[44px] justify-center">
              <Text className="font-heading-bold text-muted-text text-[13px] uppercase">Skip</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="px-lg pt-lg pb-lg gap-md">
            <Text className="font-heading-semibold text-lime text-[13px] tracking-label uppercase">{step.eyebrow}</Text>
            <Text accessibilityRole="header" className="font-heading text-white text-[42px] leading-[44px] uppercase">{step.title}</Text>
            <Text className="font-body text-muted-text text-[16px] leading-[24px]">{step.body}</Text>
          </ScrollView>
          <View className="px-lg pb-lg pt-sm">
            <View className="flex-row gap-xs mb-lg" accessibilityLabel={`Step ${index + 1} of ${FIRST_RUN_TOUR_STEPS.length}`}>
              {FIRST_RUN_TOUR_STEPS.map((item, i) => (
                <View key={item.title} className={`h-[6px] flex-1 rounded-full ${i <= index ? 'bg-lime' : 'bg-border'}`} />
              ))}
            </View>
            <LimeButton
              label={last ? 'Start my check-in' : 'Next'}
              onPress={() => (last ? onFinish(true) : setIndex(index + 1))}
            />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
