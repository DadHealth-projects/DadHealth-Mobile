import React, { memo } from 'react';
import { Text, View } from 'react-native';

type StatCardProps = {
  value: string;
  label: string;
  /** Web renders these compact stats on dark cards with a lime value. */
  className?: string;
};

const EMPTY_STAT_PROMPTS: Record<string, string> = {
  Workouts: 'Log your first workout',
  'Journal entries': 'Write your first entry',
  'Dad dates': 'Plan a Dad Date',
  'Avg sleep': 'Log your sleep',
  'Day streak': 'Check in today',
  'Avg mood': 'Complete a check-in',
};

function StatCard({ value, label, className = '' }: StatCardProps) {
  const prompt = (value === '0' || value === '—') ? EMPTY_STAT_PROMPTS[label] : null;

  return (
    <View className={`flex-1 rounded-card border border-lime/20 bg-card p-md ${className}`}>
      <Text
        className={prompt ? 'font-heading-bold text-lime text-[16px] leading-[19px]' : 'font-heading text-lime text-[26px] leading-[26px]'}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {prompt ?? value}
      </Text>
      <Text className="font-body text-muted-text text-[10px] tracking-[1px] uppercase mt-xs">
        {label}
      </Text>
    </View>
  );
}

export default memo(StatCard);
