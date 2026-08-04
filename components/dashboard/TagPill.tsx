import React, { memo } from 'react';
import { Text, View } from 'react-native';

type TagPillProps = {
  label: string;
  /** `lime` = filled (used on dark surfaces), `dark` = filled on lime surfaces. */
  tone?: 'lime' | 'dark' | 'outline';
};

/** Native equivalent of the web `.tag-pill`. */
function TagPill({ label, tone = 'lime' }: TagPillProps) {
  const surface =
    tone === 'lime' ? 'bg-lime/15' : tone === 'dark' ? 'bg-dark/10' : 'border border-lime/40';
  const text = tone === 'dark' ? 'text-dark/70' : 'text-lime';

  return (
    <View className={`rounded-full px-sm py-[3px] ${surface}`}>
      <Text className={`font-heading-bold text-[10px] tracking-[1px] uppercase ${text}`}>
        {label}
      </Text>
    </View>
  );
}

export default memo(TagPill);
