import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme';

type CircleCardProps = {
  id: string;
  leading: React.ReactNode;
  name: string;
  description: string | null;
  membersCount: number | null;
  joined: boolean;
  visibility?: 'public' | 'private';
  onOpen: (id: string) => void;
};

function CircleCard({ id, leading, name, description, membersCount, joined, visibility = 'public', onOpen }: CircleCardProps) {
  return (
    <Pressable
      onPress={() => onOpen(id)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name} Circle`}
      className="flex-col rounded-card border border-border bg-card p-md active:opacity-75"
    >
      <View className="flex-row items-center gap-sm">
        <View className="h-[38px] w-[38px] rounded-full bg-lime items-center justify-center">
  {leading}
</View>
        <View className="flex-1 flex-row items-center justify-between gap-xs">
          <Text className="flex-1 font-heading-bold text-white text-[15px] tracking-[0.5px] uppercase" numberOfLines={2}>{name}</Text>
          {visibility === 'private' ? <Text className="shrink-0 font-heading-bold text-tertiary-text text-[11px] uppercase">Private</Text> : null}
        </View>
        <Feather name="chevron-right" size={20} color={colors.lime} />
      </View>
      {description ? <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-sm">{description}</Text> : null}
      <View className="flex-row items-center gap-md pt-md">
        <Text className="font-heading-bold text-tertiary-text text-[11px] tracking-[0.5px] uppercase">{membersCount ?? 0} {(membersCount ?? 0) === 1 ? 'dad' : 'dads'}</Text>
        {joined ? <Text className="font-heading-bold text-tertiary-text text-[11px] tracking-[0.5px] uppercase">Joined ✓</Text> : null}
      </View>
    </Pressable>
  );
}

export default memo(CircleCard);
