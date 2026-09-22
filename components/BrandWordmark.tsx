import React, { memo } from 'react';
import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

type BrandWordmarkProps = {
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  source?: ImageSourcePropType;
};

function BrandWordmark({ width = 128, height = 44, style, source }: BrandWordmarkProps) {
  return (
    <Image
      source={source ?? require('../assets/wordmark.png')}
      resizeMode="contain"
      accessibilityLabel="Dad Health"
      style={[{ width, height }, style]}
    />
  );
}

export default memo(BrandWordmark);