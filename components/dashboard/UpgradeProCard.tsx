import React, { memo } from 'react';

import ProUpgradeSection from '../ProUpgradeSection';
import { PRO_MOMENTS } from '../../lib/proMoments';

type UpgradeProCardProps = {
  onPress?: () => void;
  /** Brief Change 02: the tease leads with the dad's own improvement, e.g.
   *  "You've improved your Body score by 6% this week." */
  insight?: string | null;
};

/**
 * Moment 1 — the Pro tease directly under the Dad Health Score on Today.
 * Flat section, not a bordered card, so it reads as part of the score story
 * rather than an advert for Pro.
 */
function UpgradeProCard({ onPress, insight }: UpgradeProCardProps) {
  return (
    <ProUpgradeSection
      moment={PRO_MOMENTS.score}
      lead={insight}
      onPress={() => onPress?.()}
    />
  );
}

export default memo(UpgradeProCard);
