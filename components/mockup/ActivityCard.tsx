import React, { memo } from 'react';
import { Text, View } from 'react-native';

type ActivityCardProps = {
  /** Emoji text or an icon element (dad date icons are icon keys, not emoji). */
  leading: React.ReactNode;
  name: string;
  description?: string | null;
  /** First badge renders lime, the rest dark (mockup `.badge.lime` / `.badge.dark`). */
  badges: string[];
  featured?: boolean;
  featuredLabel?: string;
};

/** Mockup 5's `.activity-card` — used for Bond's dad date ideas. */
function ActivityCard({
  leading,
  name,
  description,
  badges,
  featured = false,
  featuredLabel = '★ Featured',
}: ActivityCardProps) {
  return (
    <View
      className={`flex-row gap-md items-start rounded-card p-md ${
        featured ? 'border border-lime/30 bg-lime/[0.04]' : 'border border-border bg-card'
      }`}
    >
      <View className="h-[38px] w-[38px] rounded-button bg-lime/10 items-center justify-center">
        {leading}
      </View>

      <View className="flex-1">
        {featured ? (
          <Text className="font-heading-bold text-lime text-[8px] tracking-[1px] uppercase mb-xs">
            {featuredLabel}
          </Text>
        ) : null}

        <Text className="font-heading-bold text-white text-[15px] tracking-[0.5px] uppercase">
          {name}
        </Text>

        {description ? (
          <Text className="font-body text-muted-text text-[12px] leading-[17px] mt-xs">
            {description}
          </Text>
        ) : null}

        {badges.length > 0 ? (
          <View className="flex-row flex-wrap gap-sm mt-sm">
            {badges.map((badge, index) => (
              <View
                key={`${badge}-${index}`}
                className={`rounded-[4px] px-sm py-[2px] ${index === 0 ? 'bg-lime' : 'bg-white/[0.08]'}`}
              >
                <Text
                  className={`font-heading-bold text-[9px] tracking-[0.5px] ${
                    index === 0 ? 'text-dark' : 'text-muted-text'
                  }`}
                >
                  {badge}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(ActivityCard);
