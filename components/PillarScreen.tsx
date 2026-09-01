import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from './AppTopBar';
import type { DashboardSection } from './AccountSheet';
import ScreenErrorNotice from './ScreenErrorNotice';
import { colors } from '../theme';

const REFRESH_SKELETON_MAX_MS = 900;

type PillarScreenProps = {
  /** Rendered instead of `children` on the first load (skeleton standard). */
  loading?: boolean;
  skeleton?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  errorMessage: string;
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
  children: React.ReactNode;
};

/**
 * Shared shell for the pillar tabs (Fit Â· Mind Â· Bond Â· Squad): safe area,
 * account button, pull-to-refresh, skeleton-first loading and the mockups'
 * 24px gutters / 32px section rhythm. Screens supply only their content.
 */
export default function PillarScreen({
  loading = false,
  skeleton,
  refreshing = false,
  onRefresh,
  error = null,
  errorMessage,
  dashboardSection,
  onSelectDashboardSection,
  children,
}: PillarScreenProps) {
  const [refreshSkeletonExpired, setRefreshSkeletonExpired] = useState(false);

  useEffect(() => {
    if (!refreshing) {
      setRefreshSkeletonExpired(false);
      return;
    }

    const timer = setTimeout(() => setRefreshSkeletonExpired(true), REFRESH_SKELETON_MAX_MS);
    return () => clearTimeout(timer);
  }, [refreshing]);

  const showSkeleton = loading || (refreshing && !refreshSkeletonExpired);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lime} />
          ) : undefined
        }
      >
        <AppTopBar
          showNavigation={Boolean(dashboardSection)}
          showBrand={!dashboardSection}
          activeSection={dashboardSection}
          onSelectSection={onSelectDashboardSection}
        />

        <ScreenErrorNotice message={error ? errorMessage : null} />

        {showSkeleton && skeleton ? skeleton : children}
      </ScrollView>

    </SafeAreaView>
  );
}
