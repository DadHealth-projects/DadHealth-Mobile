import React, { memo } from 'react';
import { Text, View } from 'react-native';

type StatCardProps = {
  value: string;
  label: string;
  /** Web renders these compact stats on dark cards with a lime value. */
  className?: string;
};

function StatCard({ value, label, className = '' }: StatCardProps) {
  return (
    <View className={`flex-1 rounded-card border border-lime/20 bg-card p-md ${className}`}>
      <Text
        className="font-heading text-lime text-[26px] leading-[26px]"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text className="font-body text-muted-text text-[10px] tracking-[1px] uppercase mt-xs">
        {label}
      </Text>
    </View>
  );
}

export default memo(StatCard);
