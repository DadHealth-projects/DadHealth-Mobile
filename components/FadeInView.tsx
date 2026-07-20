import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

type FadeInViewProps = {
  children: React.ReactNode;
  /** Delay before the animation starts (ms) — used to stagger cards. */
  delay?: number;
  duration?: number;
  /** How far it slides up from (px). */
  offsetY?: number;
};

/**
 * Fade + slide-up entrance using React Native's built-in Animated API.
 *
 * Deliberately NOT Reanimated: Reanimated 4's worklets runtime throws
 * "Exception in HostFunction" during native init in Expo Go on some setups.
 * The built-in driver has no native-module dependency, so it always runs.
 */
export default function FadeInView({
  children,
  delay = 0,
  duration = 450,
  offsetY = 16,
}: FadeInViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offsetY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, duration, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
