import React, { memo } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import LimeButton from '../LimeButton';
import FadeInView from '../FadeInView';
import { HERO, IMAGES } from '../../lib/homeContent';

type PublicHeroProps = {
  onPrimary: () => void;
  onSecondary: () => void;
};

/**
 * Web `components/home/HeroSection.tsx` as a native banner: same image, scrim,
 * kicker, DAD / HEALTH lockup, quote and CTA pair. Full-width buttons stack
 * instead of sitting side by side so neither label truncates on a phone.
 */
function PublicHero({ onPrimary, onSecondary }: PublicHeroProps) {
  return (
    <View className="rounded-card overflow-hidden">
      <ImageBackground source={{ uri: IMAGES.hero }} resizeMode="cover">
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

        {/* DH badge — web places it top-right of the hero */}
        <View className="absolute top-md right-md h-[36px] w-[36px] border-2 border-white bg-dark items-center justify-center">
          <Text className="font-heading text-[14px] tracking-[0.5px]">
            <Text className="text-lime">D</Text>
            <Text className="text-white">H</Text>
          </Text>
        </View>

        <FadeInView>
          <View className="px-lg pt-[72px] pb-lg">
            <Text className="font-heading-semibold text-lime text-[12px] tracking-label uppercase">
              {HERO.label}
            </Text>

            <Text className="font-heading text-[64px] leading-[60px] uppercase mt-md">
              <Text className="text-lime">{HERO.titleAccent}</Text>
            </Text>
            <Text className="font-heading text-white text-[64px] leading-[60px] uppercase">
              {HERO.titleRest}
            </Text>

            <Text className="font-body text-white/80 text-[15px] leading-[23px] mt-lg">
              {HERO.quote}
            </Text>

            <View className="gap-sm mt-lg">
              <LimeButton label={HERO.primaryCta} onPress={onPrimary} />
              <Pressable
                onPress={onSecondary}
                accessibilityRole="button"
                accessibilityLabel={HERO.secondaryCta}
                className="rounded-button border border-white py-md items-center active:opacity-70"
              >
                <Text className="font-heading-bold text-white text-[14px] tracking-[1px] uppercase">
                  {HERO.secondaryCta}
                </Text>
              </Pressable>
            </View>
          </View>
        </FadeInView>
      </ImageBackground>
    </View>
  );
}

export default memo(PublicHero);
