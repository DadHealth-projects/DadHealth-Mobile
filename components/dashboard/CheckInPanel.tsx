import React, { memo } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import MoodCheckInRow, { type MoodKey } from '../mockup/MoodCheckInRow';
import InlineFormError from '../InlineFormError';
import { colors } from '../../theme';

type CheckInPanelProps = {
  selectedKey: MoodKey;
  onSelectMood: (key: MoodKey, value: number) => void;
  stressLevel: number | null;
  onSelectStress: (value: number) => void;
  sleep: string;
  onChangeSleep: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
};

/**
 * The web daily check-in (mood + sleep hours + save) laid out the way Mockup 1
 * does it: inside the lime score card, under a `DAILY CHECK-IN` label, with the
 * 5-emotion row. Controls invert to dark-on-lime because the surface is lime.
 */
function CheckInPanel({
  selectedKey,
  onSelectMood,
  stressLevel,
  onSelectStress,
  sleep,
  onChangeSleep,
  onSave,
  saving,
  error,
}: CheckInPanelProps) {
  return (
    <View>
      <Text className="font-heading-bold text-dark/60 text-[11px] tracking-[0.5px] uppercase mb-sm">
        How are you feeling today?
      </Text>
      <MoodCheckInRow selectedKey={selectedKey} onSelect={onSelectMood} disabled={saving} />

      <Text className="font-heading-bold text-dark/60 text-[11px] tracking-[0.5px] uppercase mt-lg mb-sm">
        How stressed do you feel today?
      </Text>
      <View accessibilityRole="radiogroup" className="flex-row gap-1">
        {[
          [1, 'Not at all'],
          [2, 'A little'],
          [3, 'Moderate'],
          [4, 'Very'],
          [5, 'Overwhelmed'],
        ].map(([value, label]) => {
          const level = value as number;
          const selected = stressLevel === level;
          return (
            <Pressable
              key={level}
              disabled={saving}
              onPress={() => onSelectStress(level)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={String(label)}
              className={`flex-1 min-h-[52px] rounded-[8px] border px-1 py-2 items-center justify-center ${
                selected ? 'border-dark bg-dark' : 'border-dark/20'
              }`}
            >
              <Text className={`font-heading-bold text-[9px] leading-[11px] uppercase text-center ${selected ? 'text-lime' : 'text-dark/60'}`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-end gap-sm mt-md">
        <View className="w-[92px]">
          <Text className="font-heading-bold text-dark/50 text-[10px] tracking-[0.5px] uppercase mb-xs">
            Sleep (h)
          </Text>
          <TextInput
            value={sleep}
            onChangeText={onChangeSleep}
            placeholder="7.5"
            placeholderTextColor="rgba(10,10,10,0.35)"
            keyboardType="decimal-pad"
            editable={!saving}
            maxLength={4}
            accessibilityLabel="Hours slept last night"
            className="h-[44px] rounded-button border-[1.5px] border-dark/20 px-md text-dark text-[16px] font-body"
          />
        </View>

        <Pressable
          onPress={onSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
          accessibilityLabel="Save daily check-in"
          style={{ opacity: saving ? 0.6 : 1 }}
          className="flex-1 h-[44px] rounded-button bg-dark items-center justify-center active:opacity-90"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.lime} />
          ) : (
            <Text className="font-heading-bold text-lime text-[14px] tracking-[1px] uppercase">
              Save
            </Text>
          )}
        </Pressable>
      </View>

      <InlineFormError message={error} surface="lime" className="mt-md" />
    </View>
  );
}

export default memo(CheckInPanel);
