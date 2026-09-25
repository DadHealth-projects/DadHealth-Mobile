import React, { useCallback, useState } from 'react';
import { type ImageSourcePropType, View } from 'react-native';

import AccountButton from './AccountButton';
import AccountSheet, { type DashboardSection } from './AccountSheet';
import AppMenuButton from './AppMenuButton';
import BrandWordmark from './BrandWordmark';

// Compact DH badge for every screen except Today (Today passes its own centred
// wordmark). The dark-background variant keeps the white "H" legible on #0A0A0A.
const DEFAULT_BRAND_SOURCE = require('../assets/DH LOGO_LimeWhite_DarkBG.png');

type AppTopBarProps = {
  showNavigation?: boolean;
  activeSection?: DashboardSection;
  onSelectSection?: (section: DashboardSection) => void;
  leftAccessory?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  showBrand?: boolean;
  brandSource?: ImageSourcePropType;
  /** Today centres its wordmark; every other screen pins the badge top-left. */
  brandAlign?: 'left' | 'center';
};

export default function AppTopBar({
  showNavigation = false,
  activeSection,
  onSelectSection,
  leftAccessory,
  rightAccessory,
  showBrand = false,
  brandSource,
  brandAlign = 'left',
}: AppTopBarProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);

  return (
    <>
      <View className="relative min-h-[44px] flex-row items-center justify-between" accessibilityRole="header">
        {showBrand && brandAlign === 'center' ? (
          <View pointerEvents="none" className="absolute inset-x-0 items-center justify-center">
            <BrandWordmark source={brandSource} width={160} height={40} />
          </View>
        ) : null}
        <View className="flex-row items-center gap-sm">
          {showNavigation ? (
            <AppMenuButton onPress={() => setNavigationOpen(true)} />
          ) : (
            leftAccessory ?? <View />
          )}
          {showBrand && brandAlign === 'left' ? (
            <BrandWordmark source={brandSource ?? DEFAULT_BRAND_SOURCE} width={49} height={40} />
          ) : null}
        </View>
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
