import React from 'react';
import { View } from 'react-native';

import SkeletonBlock from './SkeletonBlock';
import SkeletonCard from './SkeletonCard';

/** Loading state for the Progress screen (score card → month report → badges). */
export default function ProgressSkeleton() {
  return (
    <View>
      <SkeletonBlock height={140} radius={16} />

      <SkeletonBlock width="45%" height={26} style={{ marginTop: 28 }} />
      <View className="flex-row gap-sm mt-md">
        <SkeletonBlock height={78} radius={16} style={{ flex: 1 }} />
        <SkeletonBlock height={78} radius={16} style={{ flex: 1 }} />
        <SkeletonBlock height={78} radius={16} style={{ flex: 1 }} />
      </View>

      <View style={{ height: 28 }} />

      <SkeletonCard lines={2} />
    </View>
  );
}
