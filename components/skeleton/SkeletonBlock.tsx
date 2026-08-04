import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  type DimensionValue,
  ViewStyle,
} from 'react-native';

import { colors } from '../../theme';

type Props = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: ViewStyle;
};

export default function SkeletonBlock({
  width = '100%',
  height,
  radius = 12,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.card,
          opacity,
        },
        style,
      ]}
    />
  );
}