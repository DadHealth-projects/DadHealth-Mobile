import React, { memo, useCallback } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

/** Web Mind screen links Samaritans; the mockup labels the row "Crisis support". */
const SAMARITANS_URL = 'https://www.samaritans.org';

type CrisisRowProps = {
  title?: string;
  subtitle?: string;
};

/** Mockup 2's crisis-support row. Always available, never gated. */
function CrisisRow({
  title = 'Crisis support',
  subtitle = 'Samaritans · CALM · Mind — always accessible',
}: CrisisRowProps) {
  const onPress = useCallback(() => {
    void Linking.openURL(SAMARITANS_URL).catch(() => {});
  }, []);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${subtitle}`}
      className="flex-row items-center gap-md rounded-card border border-border bg-card px-md py-md active:opacity-85"
    >
      <Text className="text-[18px]">🆘</Text>
      <View className="flex-1">
        <Text className="font-heading-bold text-white text-[12px] tracking-[0.5px] uppercase">
          {title}
        </Text>
        <Text className="font-body text-white/40 text-[11px] leading-[16px] mt-xs">{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export default memo(CrisisRow);
