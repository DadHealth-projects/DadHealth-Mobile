import React, { memo } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';

import MoodCheckInRow, { type MoodKey } from '../mockup/MoodCheckInRow';
import InlineFormError from '../InlineFormError';
import { colors } from '../../theme';

type CheckInPanelProps = {
  selectedKey: MoodKey;
  onSelectMood: (key: MoodKey, value: number) => void;
  energyLevel: number | null;
  onSelectEnergy: (value: number) => void;
  connectionLevel: number | null;
  onSelectConnection: (value: number) => void;
  sleep: string;
  onChangeSleep: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
};

/** Three required 1–5 answers, followed by optional Sleep hours. */
function CheckInPanel({
  selectedKey,
  onSelectMood,
  energyLevel,
  onSelectEnergy,
  connectionLevel,
  onSelectConnection,
  sleep,
  onChangeSleep,
  onSave,
  saving,
  error,
}: CheckInPanelProps) {
  return (
    <View>
      <Text className="font-heading-bold text-dark/60 text-[11px] tracking-[0.5px] uppercase mb-sm">Mood</Text>
      <MoodCheckInRow selectedKey={selectedKey} onSelect={onSelectMood} disabled={saving} />

      <Text className="font-heading-bold text-dark/60 text-[11px] tracking-[0.5px] uppercase mt-lg mb-sm">
        Energy
      </Text>
      <CheckInScaleRow
        options={['Exhausted', 'Low', 'Okay', 'Good', 'Full of energy']}
        selectedValue={energyLevel}
        onSelect={onSelectEnergy}
        disabled={saving}
      />

      <Text className="font-heading-bold text-dark/60 text-[11px] tracking-[0.5px] uppercase mt-lg mb-sm">Connection</Text>
      <CheckInScaleRow
        options={['Disconnected', 'Distant', 'Neutral', 'Connected', 'Very connected']}
        selectedValue={connectionLevel}
        onSelect={onSelectConnection}
        disabled={saving}
      />

      <View className="flex-row items-end gap-sm mt-md">
        <View className="flex-1">
          <Text className="font-heading-bold text-dark/50 text-[10px] tracking-[0.5px] uppercase mb-xs">Sleep (optional)</Text>
          <TextInput
            value={sleep}
            onChangeText={(value) => onChangeSleep(value.replace(/[^0-9.]/g, ''))}
            placeholder="Add sleep hours"
            placeholderTextColor="rgba(10,10,10,0.35)"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
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

function CheckInScaleRow({
  options,
  selectedValue,
  onSelect,
  disabled,
}: {
  options: string[];
  selectedValue: number | null;
  onSelect: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row gap-1">
      {options.map((label, index) => {
        const value = index + 1;
        const selected = selectedValue === value;
        return (
          <Pressable
            key={label}
            disabled={disabled}
            onPress={() => onSelect(value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            className={`flex-1 min-h-[52px] rounded-[8px] border px-1 py-2 items-center justify-center ${selected ? 'border-dark bg-dark' : 'border-dark/20'}`}
          >
            <Text className={`font-heading-bold text-[9px] leading-[11px] uppercase text-center ${selected ? 'text-lime' : 'text-dark/60'}`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(CheckInPanel);
