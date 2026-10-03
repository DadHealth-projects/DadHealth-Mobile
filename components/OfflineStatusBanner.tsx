import React, { type ReactNode } from 'react';
import { View } from 'react-native';

/** Historical wrapper name retained; connectivity now renders in the bottom toast. */
export default function OfflineStatusBanner({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: 'transparent' }}>{children}</View>;
}
