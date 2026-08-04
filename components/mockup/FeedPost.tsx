import React, { memo } from 'react';
import { Text, View } from 'react-native';

type FeedPostProps = {
  authorName: string;
  authorInitials: string;
  anonymous: boolean;
  tag: string | null;
  body: string;
};

/** Mockup 4's `.feed-post`: avatar (lime or anon) + name + tag pill + body. */
function FeedPost({ authorName, authorInitials, anonymous, tag, body }: FeedPostProps) {
  return (
    <View className="rounded-card border border-border bg-card p-md">
      <View className="flex-row items-center gap-sm mb-sm">
        <View
          className={`h-[28px] w-[28px] rounded-full items-center justify-center border ${
            anonymous ? 'bg-white/5 border-white/[0.12]' : 'bg-lime/10 border-lime'
          }`}
        >
          <Text
            className={`font-heading-bold text-[10px] ${anonymous ? 'text-white/40' : 'text-lime'}`}
          >
            {authorInitials}
          </Text>
        </View>

        <Text className="flex-1 font-heading-bold text-white text-[13px]" numberOfLines={1}>
          {authorName}
        </Text>

        {tag ? (
          <View className="bg-lime rounded-[3px] px-sm py-[2px]">
            <Text className="font-heading-bold text-dark text-[8px] tracking-[1px] uppercase">
              {tag}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="font-body text-white/65 text-[13px] leading-[20px]">{body}</Text>
    </View>
  );
}

export default memo(FeedPost);
