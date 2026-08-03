import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import AccountButton from './AccountButton';
import AccountSheet from './AccountSheet';
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
  label: string;
  title: string;
  intro?: string;

  cards?: readonly ScaffoldCard[];

  ctaLabel?: string;
  onPressCTA?: () => void;
  ctaLoading?: boolean;

  children?: React.ReactNode;
};

const ANIMATION_DELAY = 120;
const ANIMATION_STEP = 90;

export default function ScreenScaffold({
  label,
  title,
  intro,
  cards,
  ctaLabel,
  onPressCTA,
  ctaLoading = false,
  children,
}: ScreenScaffoldProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  const openAccountSheet = useCallback(() => {
    setAccountOpen(true);
  }, []);

  const closeAccountSheet = useCallback(() => {
    setAccountOpen(false);
  }, []);

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.dark,
      }}
    >
      <ScrollView
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl"
>
        <View
          className="flex-row justify-end"
          accessibilityRole="header"
        >
          <AccountButton onPress={openAccountSheet} />
        </View>

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

        {cards?.map((card, index) => (
          <FadeInView
            key={card.title}
            delay={ANIMATION_DELAY + index * ANIMATION_STEP}
          >
            <Card className="flex-row gap-md items-start">
              <View className="h-[46px] w-[46px] rounded-button bg-lime/10 items-center justify-center">
                <Feather
                  name={card.icon}
                  size={22}
                  color={colors.lime}
                />
              </View>

              <View className="flex-1">
                <Text className="font-heading-bold text-white text-[21px] leading-[24px] uppercase tracking-[0.5px]">
                  {card.title}
                </Text>

                <Text className="font-body text-muted-text text-[14px] leading-[22px] mt-xs">
                  {card.description}
                </Text>
              </View>
            </Card>
          </FadeInView>
        ))}

        {children}

        {ctaLabel ? (
          <FadeInView
            delay={ANIMATION_DELAY + (cards?.length ?? 0) * ANIMATION_STEP}
          >
            <LimeButton
              label={ctaLabel}
              onPress={onPressCTA}
              loading={ctaLoading}
              accessibilityLabel={ctaLabel}
            />
          </FadeInView>
        ) : null}
      </ScrollView>

      <AccountSheet
        visible={accountOpen}
        onClose={closeAccountSheet}
      />
    </SafeAreaView>
  );
}