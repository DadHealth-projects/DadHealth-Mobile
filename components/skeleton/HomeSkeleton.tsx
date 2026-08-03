import React from 'react';
import { ScrollView, View } from 'react-native';

import SkeletonBlock from './SkeletonBlock';
import SkeletonCard from './SkeletonCard';

export default function HomeSkeleton() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerClassName="px-lg pt-lg pb-[120px]"
    >
      <View className="items-end mb-xl">
        <SkeletonBlock
          width={44}
          height={44}
          radius={22}
        />
      </View>

      <SkeletonBlock
        width="28%"
        height={14}
      />

      <SkeletonBlock
        width="72%"
        height={46}
        style={{ marginTop: 18 }}
      />

      <SkeletonBlock
        width="48%"
        height={46}
        style={{ marginTop: 10 }}
      />

      <View style={{ height: 24 }} />

      <SkeletonCard />

      <View style={{ height: 18 }} />

      <SkeletonCard />

      <View style={{ height: 18 }} />

      <SkeletonCard />

      <View style={{ height: 18 }} />

      <SkeletonCard />
    </ScrollView>
  );
}