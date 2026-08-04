import React, { memo } from 'react';
import { Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  /** Small uppercase kicker above the title (web `.section-label`). */
  label?: string;
  caption?: string;
  className?: string;
};

/** Shared section heading for dashboard + public Home sections. */
function SectionHeader({ title, label, caption, className = '' }: SectionHeaderProps) {
  return (
    <View className={className}>
      {label ? (
        <Text className="font-heading-semibold text-lime text-[12px] tracking-label uppercase mb-sm">
          {label}
        </Text>
      ) : null}
      <Text className="font-heading-bold text-white text-[22px] leading-[24px] tracking-[0.5px] uppercase">
        {title}
      </Text>
      {caption ? (
        <Text className="font-body text-muted-text text-[13px] leading-[19px] mt-xs">{caption}</Text>
      ) : null}
    </View>
  );
}

export default memo(SectionHeader);
