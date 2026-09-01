import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import SectionHeader from './SectionHeader';
import { colors } from '../../theme';

export type SupportingTool = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
};

function SupportingTools({ tools }: { tools: SupportingTool[] }) {
  return (
    <View>
      <SectionHeader title="Supporting tools" className="mb-sm" />
      <View className="border-t border-border">
        {tools.map((tool) => (
          <Pressable
            key={tool.key}
            onPress={tool.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${tool.title}. ${tool.detail}`}
            className="min-h-[72px] flex-row items-center gap-md border-b border-border py-md active:bg-white/[0.03]"
          >
            <View className="h-[40px] w-[40px] rounded-button bg-lime/10 items-center justify-center">
              <Feather name={tool.icon} size={20} color={colors.lime} />
            </View>
            <View className="flex-1">
              <Text className="font-heading-bold text-white text-[16px] uppercase">{tool.title}</Text>
              <Text className="font-body text-muted-text text-[12px] leading-[17px] mt-xs">{tool.detail}</Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.lime} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default memo(SupportingTools);
