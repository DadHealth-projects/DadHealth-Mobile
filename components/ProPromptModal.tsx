
import React, { memo, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import type { ProMoment } from '../lib/proMoments';
import { colors } from '../theme';
import LimeButton from './LimeButton';

type ProPromptModalProps = {
  visible: boolean;
  moment: ProMoment;
  onUpgrade: () => void;
  onDismiss: () => void;
  lead?: string | null;
};

function ProPromptModal({
  visible,
  moment,
  onUpgrade,
  onDismiss,
  lead,
}: ProPromptModalProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(60);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, sheetTranslateY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <View className="flex-1 justify-end">
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            opacity: backdropOpacity,
          }}
        />

        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Dad Health Pro"
          className="absolute inset-0"
        />

        <Animated.View
          style={{
            transform: [{ translateY: sheetTranslateY }],
          }}
        >
          <SafeAreaView
            edges={['bottom']}
            className="rounded-t-[28px] bg-dark px-lg pt-lg"
          >
            <View className="gap-lg pb-lg">
              <View className="flex-row items-start justify-between gap-md">
                <View className="flex-1">
                  <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                    {moment.eyebrow}
                  </Text>
                  <Text className="font-heading text-white text-[28px] leading-[30px] uppercase mt-xs">
                    {moment.heading}
                  </Text>
                </View>

                <Pressable
                  onPress={onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel="Not now"
                  hitSlop={8}
                  className="h-[40px] w-[40px] items-center justify-center active:opacity-70"
                >
                  <Feather name="x" size={20} color={colors.mutedText} />
                </Pressable>
              </View>

              {lead ? (
                <Text className="font-body text-white text-[13px] leading-[20px]">
                  {lead}
                </Text>
              ) : null}

              <Text className="font-body text-muted-text text-[13px] leading-[20px]">
                {moment.body}
              </Text>

              <LimeButton label={moment.cta} onPress={onUpgrade} />

              <Pressable
                onPress={onDismiss}
                accessibilityRole="button"
                className="min-h-[44px] items-center justify-center active:opacity-70"
              >
                <Text className="font-heading-bold text-muted-text text-[11px] uppercase">
                  Not now
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default memo(ProPromptModal);
