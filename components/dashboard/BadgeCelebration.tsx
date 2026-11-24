import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { celebrationText, newlyEarnedBadges, type EarnedBadge } from '../../lib/badgeCelebration';
import { readSeenBadges, writeSeenBadges } from '../../lib/offlineStorage';

/** Brief 07: a short celebratory message when a server-awarded badge is earned. */
export default function BadgeCelebration({ userId, badges }: { userId: string; badges: readonly EarnedBadge[] | null }) {
  const [fresh, setFresh] = useState<EarnedBadge[]>([]);
  const owner = useRef(userId);
  owner.current = userId;
  const names = badges ? badges.map((badge) => badge.name).sort().join('\n') : null;

  useEffect(() => { setFresh([]); }, [userId]);

  useEffect(() => {
    if (!badges || names === null) return;
    let active = true;
    void (async () => {
      const seen = await readSeenBadges(userId).catch(() => undefined);
      if (!active || owner.current !== userId || seen === undefined) return;
      const next = newlyEarnedBadges(badges, seen);
      if (next.length) setFresh(next);
      // Record the baseline (or the celebrated badges) so each is shown once.
      if (seen === null || next.length) await writeSeenBadges(userId, badges.map((badge) => badge.name)).catch(() => undefined);
    })();
    return () => { active = false; };
    // names captures the content of badges, so equal lists do not re-run.
  }, [names, userId]);

  const message = celebrationText(fresh);
  if (!message) return null;
  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-center gap-md rounded-[14px] border border-lime bg-card p-md">
      <Text className="text-[22px]" accessibilityElementsHidden importantForAccessibility="no">{fresh[0].icon}</Text>
      <Text className="flex-1 font-body text-white text-[14px] leading-[20px]">{message}</Text>
      <Pressable onPress={() => setFresh([])} accessibilityRole="button" accessibilityLabel="Dismiss badge message" className="min-h-[44px] justify-center">
        <Text className="font-heading-bold text-lime text-[12px] uppercase">Nice</Text>
      </Pressable>
    </View>
  );
}
