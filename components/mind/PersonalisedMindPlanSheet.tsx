import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { colors } from '../../theme';

type PersonalisedMindPlanSheetProps = {
  onClose: () => void;
};

/** Entry placeholder; Jamie's approved plan content can replace this surface later. */
export default function PersonalisedMindPlanSheet({ onClose }: PersonalisedMindPlanSheetProps) {
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss personalised Mind plan"
          className="absolute inset-0 bg-black/75"
        />
        <SafeAreaView edges={['bottom']} className="rounded-t-[28px] border-t border-lime/25 bg-dark px-lg pt-lg">
          <View className="gap-lg pb-lg">
            <View className="flex-row items-start justify-between gap-md">
              <View className="flex-1 gap-xs">
                <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Pro</Text>
                <Text className="font-heading text-white text-[26px] leading-[29px] uppercase">Personalised Mind Plan</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close personalised Mind plan"
                hitSlop={8}
                className="h-[44px] w-[44px] items-center justify-center"
              >
                <Feather name="x" size={20} color={colors.mutedText} />
              </Pressable>
            </View>
            <Text className="font-body text-muted-text text-[14px] leading-[21px]">
              This Pro feature is designed to bring together your mood, Dad Health Score and history. Your plan content will appear here when available.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
