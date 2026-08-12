import React, { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

type CircleCardProps = {
  id: string;
  /** Icon element — `circles.icon` holds an icon key, not an emoji. */
  leading: React.ReactNode;
  name: string;
  membersCount: number | null;
  joined: boolean;
  onToggle?: (id: string, joined: boolean) => void;
  busy?: boolean;
};

/**
 * Mockup 4's `.circle-card` (2-column grid, joined variant).
 *
 * The `circles` table has no description column, so no strapline is shown —
 * inventing copy would break the "never invent" rule.
 */
function CircleCard({ id, leading, name, membersCount, joined, onToggle, busy = false }: CircleCardProps) {
  const onPress = useCallback(() => onToggle?.(id, joined), [id, joined, onToggle]);

  return (
    <Pressable
      onPress={onToggle ? onPress : undefined}
      disabled={!onToggle || busy}
      accessibilityRole="button"
      accessibilityState={{ selected: joined }}
      accessibilityLabel={`${name} — ${joined ? 'Joined' : 'Join'}`}
      className={`flex-1 rounded-card p-md ${
        joined ? 'border border-lime/35 bg-lime/[0.05]' : 'border border-border bg-card'
      } active:opacity-85`}
    >
      <View className="h-[34px] w-[34px] rounded-button bg-lime/10 items-center justify-center">
        {leading}
      </View>

      <Text className="font-heading-bold text-white text-[14px] tracking-[0.5px] uppercase mt-sm">
        {name}
      </Text>

      <View className="flex-row items-center justify-between mt-md">
        <Text className="font-heading-bold text-tertiary-text text-[9px] tracking-[0.5px] uppercase">
          {membersCount ?? 0} dads
        </Text>
        <Text
          className={`font-heading-bold text-[9px] tracking-[1px] uppercase ${
            joined ? 'text-lime' : busy ? 'text-white/25' : 'text-tertiary-text'
          }`}
        >
          {busy ? 'Saving' : joined ? 'Joined ✓' : 'Join'}
        </Text>
      </View>
    </Pressable>
  );
}

export default memo(CircleCard);
