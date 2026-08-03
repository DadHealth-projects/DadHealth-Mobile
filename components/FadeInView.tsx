import React, { memo, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

type FadeInViewProps = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  offsetY?: number;
};

function FadeInView({
  children,
  delay = 0,
  duration = 450,
  offsetY = 16,
}: FadeInViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offsetY)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [delay, duration, opacity, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default memo(FadeInView);