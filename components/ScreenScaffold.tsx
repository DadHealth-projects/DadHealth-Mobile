import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Card from './Card';
import FadeInView from './FadeInView';
import LimeButton from './LimeButton';
import { colors } from '../theme';

export type ScaffoldCard = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
};

type ScreenScaffoldProps = {
  /** Small uppercase eyebrow above the title — web `.section-label`. */
  label: string;
  /** Hero heading — web `<h1>` in Barlow Condensed. */
  title: string;
  /** Optional lead paragraph under the title. */
  intro?: string;
  /** Feature cards rendered below the hero. */
  cards?: ScaffoldCard[];
  /** Optional lime CTA at the bottom. */
  ctaLabel?: string;
};

/**
 * Shared page shell matching the web hero pattern (section-label + Barlow
 * Condensed h1) on a dark background, with rounded shadowed feature cards that
 * stagger in via Reanimated.
 */
export default function ScreenScaffold({
  label,
  title,
  intro,
  cards = [],
  ctaLabel,
}: ScreenScaffoldProps) {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-xl pb-[120px] gap-lg"
      >
        {/* Hero header */}
        <FadeInView>
          <View className="flex-row items-center gap-sm mb-md">
            <View className="h-[18px] w-[4px] rounded-full bg-lime" />
            <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
              {label}
            </Text>
          </View>
          <Text className="font-heading text-white text-[46px] leading-[48px] uppercase">
            {title}
          </Text>
          {intro ? (
            <Text className="font-body text-muted-text text-[15px] leading-[24px] mt-md">
              {intro}
            </Text>
          ) : null}
        </FadeInView>

        {/* Feature cards (staggered entrance) */}
        {cards.map((c, i) => (
          <FadeInView key={c.title} delay={120 + i * 90}>
            <Card className="flex-row gap-md items-start">
              <View className="h-[46px] w-[46px] rounded-button bg-lime/10 items-center justify-center">
                <Feather name={c.icon} size={22} color={colors.lime} />
              </View>
              <View className="flex-1">
                <Text className="font-heading-bold text-white text-[21px] leading-[24px] uppercase tracking-[0.5px]">
                  {c.title}
                </Text>
                <Text className="font-body text-muted-text text-[14px] leading-[22px] mt-xs">
                  {c.description}
                </Text>
              </View>
            </Card>
          </FadeInView>
        ))}

        {/* CTA */}
        {ctaLabel ? (
          <FadeInView delay={120 + cards.length * 90}>
            <LimeButton label={ctaLabel} />
          </FadeInView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
