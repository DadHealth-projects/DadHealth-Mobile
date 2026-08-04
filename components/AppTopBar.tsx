import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import AccountButton from './AccountButton';
import AccountSheet, { type DashboardSection } from './AccountSheet';
import AppMenuButton from './AppMenuButton';

type AppTopBarProps = {
  showNavigation?: boolean;
  activeSection?: DashboardSection;
  onSelectSection?: (section: DashboardSection) => void;
  rightAccessory?: React.ReactNode;
};

export default function AppTopBar({
  showNavigation = false,
  activeSection,
  onSelectSection,
  rightAccessory,
}: AppTopBarProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);

  return (
    <>
      <View className="flex-row items-center justify-between" accessibilityRole="header">
        {showNavigation ? (
          <AppMenuButton onPress={() => setNavigationOpen(true)} />
        ) : (
          <View />
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
