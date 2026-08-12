import React, { memo } from 'react';
import { Text, View } from 'react-native';

type StatTileProps = {
  value: string;
  label: string;
};

function StatTile({ value, label }: StatTileProps) {
  return (
    <View className="flex-1 rounded-[12px] border border-lime/15 bg-lime/5 px-md py-md">
      <Text className="font-heading text-lime text-[30px] leading-[30px]">
        {value}
      </Text>

      <Text className="font-body text-muted-text text-[11px] leading-[16px] mt-[4px]">
        {label}
      </Text>
    </View>
  );
}

export default memo(StatTile);