import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

type AvatarSize = 'post' | 'detail' | 'comment';

const sizeClasses: Record<AvatarSize, { box: string; text: string }> = {
  post: { box: 'h-[36px] w-[36px]', text: 'text-[11px]' },
  detail: { box: 'h-[40px] w-[40px]', text: 'text-[14px]' },
  comment: { box: 'h-[28px] w-[28px]', text: 'text-[9px]' },
};

export default function CommunityAuthorAvatar({
  avatarUrl,
  initials,
  anonymous = false,
  size = 'post',
}: {
  avatarUrl: string | null;
  initials: string;
  anonymous?: boolean;
  size?: AvatarSize;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions = sizeClasses[size];
  const showPhoto = !anonymous && Boolean(avatarUrl) && !imageFailed;

  useEffect(() => setImageFailed(false), [avatarUrl]);

  if (showPhoto && avatarUrl) {
    return (
      <View className={`${dimensions.box} overflow-hidden rounded-full border border-lime/40`}>
        <Image
          source={{ uri: avatarUrl }}
          className="h-full w-full rounded-full"
          resizeMode="cover"
          accessible={false}
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  return (
    <View className={`${dimensions.box} items-center justify-center border ${anonymous ? 'bg-white/5 border-white/15' : 'bg-lime/10 border-lime'}`}>
      <Text className={`font-heading-bold ${dimensions.text} ${anonymous ? 'text-tertiary-text' : 'text-lime'}`}>
        {anonymous ? 'A' : initials}
      </Text>
    </View>
  );
}
