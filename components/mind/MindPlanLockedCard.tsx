
import React, { useEffect, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';

import LimeButton from '../LimeButton';
import { colors } from '../../theme';
import { trackEvent } from '../../lib/analytics';

type MindPlanLockedCardProps = {
  onUnlock: () => void;
  userId?: string;
};

export default function MindPlanLockedCard({
  onUnlock,
  userId,
}: MindPlanLockedCardProps) {
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackEvent('lock_viewed', { feature: 'mind_plan', source: 'mind_plan' }, userId);
  }, [userId]);
  return (
    <View className="rounded-[16px] border border-lime/40 bg-card p-md">
      <View className="flex-row items-start justify-between gap-sm">
        <View className="flex-1">
          <Text className="font-heading-bold text-[10px] text-lime uppercase tracking-label">
            Personalised
          </Text>
          <Text className="font-heading text-[22px] leading-[26px] mt-xs text-white uppercase">
            Personalised Mind Plan
          </Text>
        </View>

        <View className="flex-row items-center gap-[5px] rounded-full bg-lime px-sm py-[5px]">
          <MaterialCommunityIcons
            name="crown"
            size={12}
            color={colors.dark}
          />
          <Text className="font-heading-bold text-[10px] uppercase text-dark">
            Pro
          </Text>
        </View>
      </View>

      <Text className="font-body text-[16px] leading-[22px] mt-md mb-md text-muted-text">
        A seven-day plan shaped around your goals.
      </Text>

      <View
        className="overflow-hidden rounded-[12px] bg-[#192113]"
        accessible
        accessibilityLabel="Locked preview of your personalised Mind Plan"
      >
        <Image
          source={require('../../assets/mind-plan-blurred-preview.png')}
          resizeMode="stretch"
          style={{
            width: '100%',
            height: 150,
          }}
        />
      </View>

      <View className="mt-md">
        <LimeButton
          label="Unlock my plan →"
          accessibilityLabel="Unlock my plan"
          onPress={onUnlock}
        />
      </View>
    </View>
  );
}
