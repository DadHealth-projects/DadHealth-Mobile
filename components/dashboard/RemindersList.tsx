import React, { memo } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Card from '../Card';
import SectionHeader from './SectionHeader';
import { dashboardIcon } from '../../lib/dashboardIcons';
import type { Reminder } from '../../hooks/useDashboard';
import { colors } from '../../theme';

type RemindersListProps = {
  /** Already capped to the web's 5 by the caller. */
  reminders: Reminder[];
};

/** Web "SMART REMINDERS" list — icon comes from `reminder.type`. */
function RemindersList({ reminders }: RemindersListProps) {
  return (
    <View>
      <SectionHeader title="Smart reminders" />
      {reminders.length === 0 ? (
        <Text className="font-body text-muted-text text-[14px]">No reminders yet</Text>
      ) : (
        <View className="gap-sm">
          {reminders.map((reminder) => (
            <Card key={reminder.id} className="flex-row items-center gap-md py-md">
              <Feather name={dashboardIcon(reminder.type ?? 'bell')} size={19} color={colors.lime} />
              <Text className="flex-1 font-body text-white text-[14px] leading-[20px]">
                {reminder.text}
              </Text>
              {reminder.time ? (
                <Text className="font-heading-semibold text-muted-text text-[11px] uppercase">
                  {reminder.time.slice(0, 5)}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

export default memo(RemindersList);
