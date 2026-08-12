import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, shadows } from '../../theme';

type PillarCardProps = {
  emoji: string;
  title: string;
  description: string;
  lime?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

function PillarCard({
  emoji,
  title,
  description,
  lime = false,
  onPress,
  accessibilityLabel,
}: PillarCardProps) {
  const card = (
    <View
      style={lime ? shadows.card : undefined}
      className={`flex-row items-start gap-[14px] rounded-[12px] border p-[16px] ${
        lime
          ? 'bg-lime border-lime'
          : 'bg-card border-white/8'
      }`}
    >
      <Text className="text-[28px]">{emoji}</Text>

      <View className="flex-1">
        <Text
          className={`font-heading-bold text-[15px] uppercase tracking-[0.5px] ${
            lime ? 'text-dark' : 'text-white'
          }`}
        >
          {title}
        </Text>

        <Text
          className={`mt-[3px] font-body text-[12px] leading-[18px] ${
            lime ? 'text-dark/60' : 'text-muted-text'
          }`}
        >
          {description}
        </Text>
      </View>

      {onPress ? (
        <View className="h-[28px] justify-center">
          <Feather name="chevron-right" size={20} color={lime ? colors.dark : colors.lime} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return card;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      className="active:opacity-80"
    >
      {card}
    </Pressable>
  );
}

export default memo(PillarCard);
