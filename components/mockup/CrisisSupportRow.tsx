import React, { memo, useCallback } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

const SAMARITANS_PHONE_URL = 'tel:116123';

type CrisisSupportRowProps = {
  title?: string;
  subtitle?: string;
};

/** Immediate support remains available without authentication or Pro access. */
function CrisisSupportRow({
  title = 'Crisis support',
  subtitle = 'Call Samaritans free on 116 123. Available any time.',
}: CrisisSupportRowProps) {
  const onPress = useCallback(() => {
    void Linking.openURL(SAMARITANS_PHONE_URL).catch(() => {
      Alert.alert(
        'Unable to start the call',
        'Please dial 116 123 directly to reach Samaritans.',
      );
    });
  }, []);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      className="flex-row items-center gap-md border-y border-red-400/25 py-md active:opacity-85"
    >
      <Feather name="life-buoy" size={22} color="#F87171" />
      <View className="flex-1">
        <Text className="font-heading-bold text-red-300 text-[12px] tracking-[0.5px] uppercase">
          {title}
        </Text>
        <Text className="font-body text-white/40 text-[11px] leading-[16px] mt-xs">{subtitle}</Text>
      </View>
      <Feather name="phone" size={18} color="#F87171" />
    </Pressable>
  );
}

export default memo(CrisisSupportRow);
