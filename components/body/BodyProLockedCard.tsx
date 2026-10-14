import React from 'react';
import { Image, type ImageSourcePropType, Text, View } from 'react-native';

import LimeButton from '../LimeButton';
import ProBadge from '../dashboard/ProBadge';

type BodyProLockedCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  preview: ImageSourcePropType;
  previewLabel: string;
  buttonLabel: string;
  onUnlock: () => void;
};

export default function BodyProLockedCard({
  eyebrow,
  title,
  description,
  preview,
  previewLabel,
  buttonLabel,
  onUnlock,
}: BodyProLockedCardProps) {
  return (
    <View className="gap-md rounded-[16px] border border-lime/40 bg-card p-md">
      <View className="flex-row items-start justify-between gap-sm">
        <View className="flex-1">
          <Text className="font-heading-bold text-lime text-[10px] uppercase tracking-label">
            {eyebrow}
          </Text>
          <Text className="mt-xs font-heading text-[22px] leading-[26px] text-white uppercase">
            {title}
          </Text>
        </View>
        <ProBadge />
      </View>

      <Text className="font-body text-[12px] leading-[18px] text-muted-text">
        {description}
      </Text>

      <View
        accessible
        accessibilityLabel={previewLabel}
        className="overflow-hidden rounded-[12px] bg-[#192113]"
      >
        <Image
          accessible={false}
          source={preview}
          resizeMode="stretch"
          style={{ width: '100%', height: 150 }}
        />
      </View>

      <LimeButton
        label={buttonLabel}
        accessibilityLabel={buttonLabel.replace(' →', '')}
        onPress={onUnlock}
      />
    </View>
  );
}
