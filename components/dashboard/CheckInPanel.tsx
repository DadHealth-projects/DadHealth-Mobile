import React, { memo } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import MoodCheckInRow, { type MoodKey } from '../mockup/MoodCheckInRow';
import { colors } from '../../theme';

type CheckInPanelProps = {
  selectedKey: MoodKey;
  onSelectMood: (key: MoodKey, value: number) => void;
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
  sleep,
  onChangeSleep,
  onSave,
  saving,
  error,
}: CheckInPanelProps) {
  return (
    <View>
      <MoodCheckInRow selectedKey={selectedKey} onSelect={onSelectMood} disabled={saving} />

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

      {error ? (
        <Text className="font-body text-[#7A1010] text-[12px] leading-[17px] mt-sm">{error}</Text>
      ) : null}
    </View>
  );
}

export default memo(CheckInPanel);
