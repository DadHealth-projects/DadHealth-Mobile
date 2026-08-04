import React from 'react';
import { View } from 'react-native';

import SkeletonBlock from './SkeletonBlock';
import SkeletonCard from './SkeletonCard';

type PillarSkeletonProps = {
  /** Set when the screen leads with the lime score card (Bond, Progress). */
  score?: boolean;
  cards?: number;
};

/** Loading state for a pillar tab: hero → optional score card → content cards. */
export default function PillarSkeleton({ score = false, cards = 3 }: PillarSkeletonProps) {
  return (
    <View>
      <SkeletonBlock width="35%" height={12} />
      <SkeletonBlock width="80%" height={44} style={{ marginTop: 16 }} />
      <SkeletonBlock width="55%" height={44} style={{ marginTop: 8 }} />
      <SkeletonBlock width="70%" height={14} style={{ marginTop: 18 }} />

      {score ? <SkeletonBlock height={148} radius={16} style={{ marginTop: 28 }} /> : null}

      {Array.from({ length: cards }).map((_, index) => (
        <View key={index} style={{ marginTop: index === 0 && !score ? 28 : 16 }}>
          <SkeletonCard lines={2} />
        </View>
      ))}
    </View>
  );
}
