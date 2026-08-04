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
