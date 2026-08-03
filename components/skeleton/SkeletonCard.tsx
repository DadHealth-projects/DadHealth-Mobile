import React from 'react';
import { View } from 'react-native';

import Card from '../Card';
import SkeletonBlock from './SkeletonBlock';

type Props = {
  lines?: number;
};

export default function SkeletonCard({
  lines = 3,
}: Props) {
  return (
    <Card>
      <View className="flex-row items-center mb-lg">
        <SkeletonBlock
          width={46}
          height={46}
          radius={23}
        />

        <View className="flex-1 ml-md">
          <SkeletonBlock
            width="55%"
            height={18}
          />

          <SkeletonBlock
            width="35%"
            height={12}
            style={{ marginTop: 10 }}
          />
        </View>
      </View>

      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock
          key={index}
          width={index === lines - 1 ? '65%' : '100%'}
          height={14}
          style={{ marginBottom: 10 }}
        />
      ))}
    </Card>
  );
}