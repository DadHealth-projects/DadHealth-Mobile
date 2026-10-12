import React, { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

type CircleCardProps = {
  id: string;
  leading: React.ReactNode;
  name: string;
  description: string | null;
  membersCount: number | null;
  joined: boolean;
  visibility?: 'public' | 'private';
  onToggle?: (id: string, joined: boolean) => void;
  busy?: boolean;
};

function CircleCard({
  id,
  leading,
  name,
  description,
  membersCount,
  joined,
  visibility = 'public',
  onToggle,
  busy = false,
}: CircleCardProps) {
  const toggle = useCallback(
    () => onToggle?.(id, joined),
    [id, joined, onToggle]
  );

  return (
    <View
      className={`flex-1 flex-col rounded-card p-md ${
        joined
          ? 'border border-lime/35 bg-lime/[0.05]'
          : 'border border-border bg-card'
      }`}
    >
      <View className="h-[34px] w-[34px] rounded-button bg-lime/10 items-center justify-center">
        {leading}
      </View>

      <View className="flex-row items-center justify-between gap-xs mt-sm">
        <Text
          className="flex-1 font-heading-bold text-white text-[14px] tracking-[0.5px] uppercase"
          numberOfLines={2}
        >
          {name}
        </Text>

        {visibility === 'private' ? (
          <Text className="font-heading-bold text-tertiary-text text-[8px] uppercase">
            Private
          </Text>
        ) : null}
      </View>

      {description ? (
        <Text className="font-body text-muted-text text-[11px] leading-[16px] mt-xs">
          {description}
        </Text>
      ) : null}

      <View className="mt-auto flex-row items-center justify-between pt-md">
        <Text className="font-heading-bold text-tertiary-text text-[9px] tracking-[0.5px] uppercase">
          {membersCount ?? 0}{' '}
          {(membersCount ?? 0) === 1 ? 'dad' : 'dads'}
        </Text>

        {onToggle ? (
          <Pressable
            onPress={toggle}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ selected: joined, disabled: busy }}
            accessibilityLabel={`${joined ? 'Leave' : 'Join'} ${name}`}
            className="min-h-[36px] justify-center"
          >
            <Text
              className={`font-heading-bold text-[9px] tracking-[0.5px] uppercase ${
                joined ? 'text-lime' : 'text-tertiary-text'
              }`}
            >
              {busy ? 'Saving' : joined ? 'Joined ✓' : 'Join'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default memo(CircleCard);