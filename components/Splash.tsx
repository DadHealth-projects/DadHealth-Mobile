import React from 'react';
import { View, ActivityIndicator, Image } from 'react-native';

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
      <Image
        source={require('../assets/DH LOGO_LimeWhite_DarkBG.png')}
        resizeMode="contain"
        accessibilityLabel="Dad Health"
        style={{ width: 180, height: 154 }}
      />
      <ActivityIndicator color={colors.lime} style={{ marginTop: 24 }} />
    </View>
  );
}
