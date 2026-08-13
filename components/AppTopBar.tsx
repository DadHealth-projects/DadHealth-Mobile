import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import AccountButton from './AccountButton';
import AccountSheet, { type DashboardSection } from './AccountSheet';
import AppMenuButton from './AppMenuButton';
import BrandWordmark from './BrandWordmark';

type AppTopBarProps = {
  showNavigation?: boolean;
  activeSection?: DashboardSection;
  onSelectSection?: (section: DashboardSection) => void;
  leftAccessory?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  showBrand?: boolean;
};

export default function AppTopBar({
  showNavigation = false,
  activeSection,
  onSelectSection,
  leftAccessory,
  rightAccessory,
  showBrand = false,
}: AppTopBarProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);

  return (
    <>
      <View className="relative min-h-[44px] flex-row items-center justify-between" accessibilityRole="header">
        {showBrand ? (
          <View pointerEvents="none" className="absolute inset-x-0 items-center justify-center">
            <BrandWordmark />
          </View>
        ) : null}
        {showNavigation ? (
          <AppMenuButton onPress={() => setNavigationOpen(true)} />
        ) : (
          leftAccessory ?? <View />
        )}
        <View className="flex-row items-center gap-sm">
          <AccountButton onPress={() => setAccountOpen(true)} />
          {rightAccessory}
        </View>
      </View>

      {showNavigation ? (
        <AccountSheet
          variant="navigation"
          visible={navigationOpen}
          onClose={closeNavigation}
          activeSection={activeSection}
          onSelectSection={onSelectSection}
        />
      ) : null}
      <AccountSheet variant="account" visible={accountOpen} onClose={closeAccount} />
    </>
  );
}
