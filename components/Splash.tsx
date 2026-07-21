import React from 'react';
import { View, ActivityIndicator } from 'react-native';

import { colors } from '../theme';

/** Dark branded splash used while auth state / biometric availability resolves. */
export default function Splash() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.dark,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={colors.lime} />
    </View>
  );
}
