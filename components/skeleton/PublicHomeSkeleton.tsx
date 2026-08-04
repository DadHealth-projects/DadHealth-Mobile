import React from 'react';
import { ScrollView, View } from 'react-native';

import SkeletonBlock from './SkeletonBlock';
import SkeletonCard from './SkeletonCard';

/** Loading state for the public (logged-out) Home, mirroring its section order. */
export default function PublicHomeSkeleton() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerClassName="px-lg pt-lg pb-[120px]"
    >
      {/* Brand row */}
      <View className="flex-row items-center justify-between mb-xl">
        <SkeletonBlock width={140} height={26} />
        <SkeletonBlock width={84} height={38} radius={12} />
      </View>

      {/* Hero */}
      <SkeletonBlock height={320} radius={16} />

      <View style={{ height: 32 }} />

      {/* Who we are */}
      <SkeletonBlock height={200} radius={16} />
      <SkeletonBlock width="60%" height={34} style={{ marginTop: 18 }} />
      <SkeletonBlock height={14} style={{ marginTop: 14 }} />
      <SkeletonBlock height={14} style={{ marginTop: 8 }} />
      <SkeletonBlock width="75%" height={14} style={{ marginTop: 8 }} />

      <View style={{ height: 32 }} />

      {/* Dashboard preview */}
      <SkeletonCard />

      <View style={{ height: 32 }} />

      {/* Stats band */}
      <SkeletonBlock height={220} radius={16} />

      <View style={{ height: 32 }} />

      {/* Pillars */}
      <SkeletonBlock width="55%" height={30} />
      <View className="flex-row gap-md mt-md">
        <SkeletonBlock width={200} height={250} radius={16} />
        <SkeletonBlock width={200} height={250} radius={16} />
      </View>
    </ScrollView>
  );
}
