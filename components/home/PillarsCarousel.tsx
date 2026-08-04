import React, { memo, useCallback } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import SectionHeader from '../dashboard/SectionHeader';
import TagPill from '../dashboard/TagPill';
import { PILLARS, PILLARS_SECTION, type PillarTab } from '../../lib/homeContent';
import { shadows } from '../../theme';

const CARD_WIDTH = 248;
const CARD_GAP = 12;

type PillarsCarouselProps = {
  onSelectPillar: (tab: PillarTab) => void;
};

type PillarCardProps = {
  tag: string;
  description: string;
  image: string;
  tab: PillarTab;
  onSelectPillar: (tab: PillarTab) => void;
};

const PillarCard = memo(function PillarCard({
  tag,
  description,
  image,
  tab,
  onSelectPillar,
}: PillarCardProps) {
  const onPress = useCallback(() => onSelectPillar(tab), [onSelectPillar, tab]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tag} — ${PILLARS_SECTION.cta}`}
      style={[shadows.card, { width: CARD_WIDTH }]}
      className="rounded-card bg-card border border-border overflow-hidden active:opacity-85"
    >
      <Image
        source={{ uri: image }}
        resizeMode="cover"
        className="w-full h-[140px] opacity-60"
        accessibilityIgnoresInvertColors
      />
      <View className="p-md gap-sm">
        <Text className="font-heading-bold text-white text-[15px] tracking-[1px] uppercase">
          {tag}
        </Text>
        <Text className="font-body text-muted-text text-[12px] leading-[18px]">{description}</Text>
        <View className="self-start mt-xs">
          <TagPill label={PILLARS_SECTION.cta} />
        </View>
      </View>
    </Pressable>
  );
});

/** Web `components/home/PillarsSection.tsx` as a swipeable card row. */
function PillarsCarousel({ onSelectPillar }: PillarsCarouselProps) {
  return (
    <View>
      <SectionHeader
        label={PILLARS_SECTION.label}
        title={PILLARS_SECTION.heading}
        className="mb-md"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        contentContainerStyle={{ gap: CARD_GAP, paddingRight: 24 }}
      >
        {PILLARS.map((pillar) => (
          <PillarCard
            key={pillar.tag}
            tag={pillar.tag}
            description={pillar.description}
            image={pillar.image}
            tab={pillar.tab}
            onSelectPillar={onSelectPillar}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default memo(PillarsCarousel);
