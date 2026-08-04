import React, { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import SectionHeader from './SectionHeader';
import { dashboardIcon } from '../../lib/dashboardIcons';
import { goalActionLabel, type DashboardGoal } from '../../lib/goalPlan';
import { colors } from '../../theme';

type TodaysPlanProps = {
  goals: DashboardGoal[];
  onGoalAction: (index: number) => void;
};

type GoalRowProps = {
  goal: DashboardGoal;
  index: number;
  onGoalAction: (index: number) => void;
};

const GoalRow = memo(function GoalRow({ goal, index, onGoalAction }: GoalRowProps) {
  const done = goal.status === 'done';
  const onPress = useCallback(() => onGoalAction(index), [index, onGoalAction]);

  return (
    <View className="flex-row items-center gap-md py-md border-b border-lime/20">
      <View className="h-[42px] w-[42px] rounded-button bg-lime/10 items-center justify-center">
        <Feather name={dashboardIcon(goal.iconKey)} size={20} color={colors.lime} />
      </View>

      <View className="flex-1">
        <Text className="font-heading-bold text-white text-[17px] leading-[19px] uppercase">
          {goal.name}
        </Text>
        <Text className="font-body text-muted-text text-[11px] tracking-[0.5px] uppercase mt-xs">
          {goal.time}
        </Text>
      </View>

      <Pressable
        onPress={onPress}
        disabled={done}
        accessibilityRole="button"
        accessibilityState={{ disabled: done }}
        accessibilityLabel={`${goalActionLabel(goal.status)}: ${goal.name}`}
        className={`min-w-[86px] rounded-button border px-sm py-sm items-center ${
          done ? 'bg-lime border-lime' : 'border-lime active:bg-lime/10'
        }`}
      >
        <Text
          className={`font-heading-bold text-[10px] tracking-[0.5px] uppercase ${
            done ? 'text-dark' : 'text-lime'
          }`}
        >
          {goalActionLabel(goal.status)}
        </Text>
      </Pressable>
    </View>
  );
});

/** Web "TODAY'S PLAN" list, built from the member's onboarding goals. */
function TodaysPlan({ goals, onGoalAction }: TodaysPlanProps) {
  return (
    <View>
      <SectionHeader title="Today's plan" />
      {goals.length === 0 ? (
        <Text className="font-body text-muted-text text-[14px] leading-[21px]">
          Add goals in onboarding to build your daily plan.
        </Text>
      ) : (
        <View className="border-t border-lime/20">
          {goals.map((goal, index) => (
            <GoalRow key={goal.name} goal={goal} index={index} onGoalAction={onGoalAction} />
          ))}
        </View>
      )}
    </View>
  );
}

export default memo(TodaysPlan);
