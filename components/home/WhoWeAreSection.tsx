import React, { memo } from 'react';
import { Image, Text, View } from 'react-native';

import LimeButton from '../LimeButton';
import { IMAGES, WHO_WE_ARE } from '../../lib/homeContent';

type WhoWeAreSectionProps = {
  onCta: () => void;
};

/** Web `components/home/WhoWeAre.tsx` — image above the copy on mobile. */
function WhoWeAreSection({ onCta }: WhoWeAreSectionProps) {
  return (
    <View>
      <Image
        source={{ uri: IMAGES.gym }}
        resizeMode="cover"
        className="w-full h-[220px] rounded-card"
        accessibilityIgnoresInvertColors
      />

      <View className="self-start bg-lime px-sm py-[2px] mt-lg">
        <Text className="font-heading-bold text-dark text-[10px] tracking-label uppercase">
          {WHO_WE_ARE.label}
        </Text>
      </View>

      <Text className="font-heading text-white text-[36px] leading-[36px] uppercase mt-md">
        {WHO_WE_ARE.heading}
      </Text>

      <View className="gap-md mt-md">
        {WHO_WE_ARE.paragraphs.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} className="font-body text-muted-text text-[14px] leading-[24px]">
            {paragraph}
          </Text>
        ))}
      </View>

      <View className="mt-lg">
        <LimeButton label={WHO_WE_ARE.cta} onPress={onCta} />
      </View>
    </View>
  );
}

export default memo(WhoWeAreSection);
