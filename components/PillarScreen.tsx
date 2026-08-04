import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from './AppTopBar';
import type { DashboardSection } from './AccountSheet';
import DashboardErrorCard from './dashboard/DashboardErrorCard';
import { colors } from '../theme';

type PillarScreenProps = {
  /** Rendered instead of `children` on the first load (skeleton standard). */
  loading?: boolean;
  skeleton?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  onRetry?: () => void;
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
  children: React.ReactNode;
};

/**
 * Shared shell for the pillar tabs (Fit · Mind · Bond · Squad): safe area,
 * account button, pull-to-refresh, skeleton-first loading and the mockups'
 * 24px gutters / 32px section rhythm. Screens supply only their content.
 */
export default function PillarScreen({
  loading = false,
  skeleton,
  refreshing = false,
  onRefresh,
  error = null,
  onRetry,
  dashboardSection,
  onSelectDashboardSection,
  children,
}: PillarScreenProps) {
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
          activeSection={dashboardSection}
          onSelectSection={onSelectDashboardSection}
        />

        {loading && skeleton ? (
          skeleton
        ) : error && onRetry ? (
          <DashboardErrorCard message={error} onRetry={onRetry} />
        ) : (
          children
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
