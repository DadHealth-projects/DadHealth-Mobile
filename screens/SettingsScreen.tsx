import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/Card';
import FadeInView from '../components/FadeInView';
import { colors } from '../theme';

/**
 * Settings — placeholder scaffold reached from the Account Sheet.
 * No functionality yet; mirrors the Profile modal's dark theme + close button.
 */
export default function SettingsScreen() {
  const navigation = useNavigation<{ goBack: () => void }>();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-xl pb-[120px] gap-lg"
      >
        {/* Close (modal) */}
        <View className="flex-row justify-end">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            className="h-[40px] w-[40px] rounded-full border border-border items-center justify-center active:opacity-70"
          >
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
        </View>

        <FadeInView>
          <View className="flex-row items-center gap-sm mb-md">
            <View className="h-[18px] w-[4px] rounded-full bg-lime" />
            <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
              Account
            </Text>
          </View>
          <Text className="font-heading text-white text-[46px] leading-[48px] uppercase">
            Settings
          </Text>
        </FadeInView>

        <FadeInView delay={120}>
          <Card className="items-center gap-md py-xl">
            <View className="h-[54px] w-[54px] rounded-button bg-lime/10 items-center justify-center">
              <Feather name="settings" size={26} color={colors.lime} />
            </View>
            <Text className="font-heading-bold text-white text-[22px] uppercase tracking-[0.5px] text-center">
              Coming Soon
            </Text>
            <Text className="font-body text-muted-text text-[14px] leading-[22px] text-center">
              Preferences, notifications and account controls will live here.
            </Text>
          </Card>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}
