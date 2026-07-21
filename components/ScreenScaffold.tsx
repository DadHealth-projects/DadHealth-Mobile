import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import AccountSheet from './AccountSheet';
import Card from './Card';
import FadeInView from './FadeInView';
import LimeButton from './LimeButton';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

function AccountButton({ onPress }: { onPress: () => void }) {
  const { user, session } = useAuth();

  const initial = session
  ? (user?.email?.[0] ?? 'D').toUpperCase()
  : '?';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={8}
      className="h-[40px] w-[40px] rounded-full border border-lime/40 bg-lime/10 items-center justify-center active:opacity-70"
    >
      <Text className="font-heading-bold text-lime text-[16px]">
        {initial}
      </Text>
    </Pressable>
  );
}

export type ScaffoldCard = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
};

type ScreenScaffoldProps = {
  label: string;
  title: string;
  intro?: string;
  cards?: ScaffoldCard[];
  ctaLabel?: string;
};

export default function ScreenScaffold({
  label,
  title,
  intro,
  cards = [],
  ctaLabel,
}: ScreenScaffoldProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.dark }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-lg pt-xl pb-[120px] gap-lg"
      >
        <View className="flex-row justify-end">
          <AccountButton onPress={() => setAccountOpen(true)} />
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

          {intro && (
            <Text className="font-body text-muted-text text-[15px] leading-[24px] mt-md">
              {intro}
            </Text>
          )}
        </FadeInView>

        {cards.map((card, index) => (
          <FadeInView
            key={card.title}
            delay={120 + index * 90}
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

        {ctaLabel && (
          <FadeInView delay={120 + cards.length * 90}>
            <LimeButton label={ctaLabel} />
          </FadeInView>
        )}
      </ScrollView>

      <AccountSheet
        visible={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </SafeAreaView>
  );
}