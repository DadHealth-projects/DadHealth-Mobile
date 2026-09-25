import React from 'react';
import { View, Image } from 'react-native';

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
        source={require('../assets/02. DAD HEALTH LOGO_COLOR_Dark BG.png')}
        resizeMode="contain"
        accessibilityLabel="Dad Health"
        style={{ width: 300, height: 75 }}
      />
    </View>
  );
}
