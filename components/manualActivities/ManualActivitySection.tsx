import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import SectionHeader from '../dashboard/SectionHeader';
import { useManualActivityHistory } from '../../hooks/useManualActivityHistory';
import { manualActivityLabel, type ManualActivityPillar } from '../../lib/manualActivities';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

export default function ManualActivitySection({ pillar, userId }: { pillar: ManualActivityPillar; userId?: string }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { activities, loading } = useManualActivityHistory(userId, pillar);
  const add = () => navigation.navigate('ManualActivityLog', { pillar });
  const history = () => navigation.navigate('ManualActivityHistory', { pillar });

  return (
    <View className="gap-sm border-b border-border pb-lg">
      <View className="flex-row items-center justify-between gap-sm">
        <SectionHeader title="Manual activity" />
        <Pressable onPress={add} accessibilityRole="button" accessibilityLabel={`Log ${pillar} activity`} className="min-h-[40px] flex-row items-center gap-xs px-sm active:opacity-70">
          <Feather name="plus" size={16} color={colors.lime} />
          <Text className="font-heading-bold text-lime text-[10px] uppercase">Log</Text>
        </Pressable>
      </View>
      {loading && activities.length === 0 ? (
        <Text className="font-body text-muted-text text-[12px]">Loading your activity…</Text>
      ) : activities.length ? (
        <View className="gap-xs">
          {activities.slice(0, 3).map((activity) => (
            <View key={activity.id} className="flex-row items-center justify-between gap-sm py-xs">
              <Text numberOfLines={1} className="flex-1 font-body text-white text-[13px]">
                {manualActivityLabel(activity)}
              </Text>
              <Text className="font-body text-muted-text text-[11px]">{activity.activity_date}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="font-body text-muted-text text-[12px]">Your logged activities will appear here.</Text>
      )}
      <Pressable onPress={history} accessibilityRole="button" accessibilityLabel={`View ${pillar} activity history`} className="self-start min-h-[40px] justify-center active:opacity-70">
        <Text className="font-heading-bold text-lime text-[10px] uppercase">View activity history</Text>
      </Pressable>
    </View>
  );
}
