import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
  } }).outputText, { exports, Promise, require(name) {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name];
  } });
  return exports;
}
const reminder = load('lib/reminderTime.ts');
const pad = (n) => String(n).padStart(2, '0');
const STEP = 'Reminder times use 15-minute steps. Choose a time ending in :00, :15, :30 or :45.';
const RANGE = 'Choose a reminder time between 08:00 and 20:45.';

test('reminder options are exactly the backend schedule: 08:00 to 20:45 in 15-minute steps', () => {
  // Oracle: the list the settings screen generated inline before this change.
  const previous = Array.from({ length: 52 }, (_, index) => {
    const minutes = 8 * 60 + index * 15;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
  });
  assert.deepEqual([...reminder.REMINDER_TIMES], previous);
  assert.equal(reminder.REMINDER_TIMES[0], '08:00:00');
  assert.equal(reminder.REMINDER_TIMES.at(-1), '20:45:00');
  for (const time of reminder.REMINDER_TIMES) assert.equal(reminder.reminderTimeError(time), null, time);
});

test('validity matches the previous rule for every minute of the day', () => {
  const previousRule = /^(?:0[89]|1[0-9]|20):(?:00|15|30|45):00$/;
  for (let minute = 0; minute < 24 * 60; minute++) {
    const time = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}:00`;
    assert.equal(reminder.reminderTimeError(time) === null, previousRule.test(time), time);
  }
});

test('off-step times inside the range explain the 15-minute rule', () => {
  for (const time of ['08:10:00', '08:01:00', '12:44:00', '20:44:00', '20:31:00', '08:15:30']) {
    assert.equal(reminder.reminderTimeError(time), STEP, time);
  }
});

test('times outside 08:00-20:45 and malformed values explain the range', () => {
  for (const time of ['07:45:00', '07:30:00', '07:59:00', '20:46:00', '21:00:00', '23:45:00', '00:00:00',
    '24:00:00', '08:60:00', '08:15:60', '8:00:00', '08:00', '', 'morning']) {
    assert.equal(reminder.reminderTimeError(time), RANGE, time);
  }
});

function settingsHook() {
  const calls = [];
  const react = { useCallback: (fn) => fn, useMemo: (fn) => fn(), useRef: (value) => ({ current: value }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect() {} };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-a' } } } }) },
    from: (table) => ({ upsert: (row, options) => { calls.push({ table, row, options }); return Promise.resolve({ error: null }); } }),
  };
  const { useNotificationSettings } = load('hooks/useNotificationSettings.ts', {
    react, '../contexts/NetworkContext': { useNetworkStatus: () => ({ isOffline: false }) },
    '../lib/supabase': { supabase }, '../lib/reminderTime': reminder,
  });
  return { settings: useNotificationSettings('owner-a'), calls };
}

test('enabling the reminder with an unsupported time is refused with the accurate reason and nothing is saved', async () => {
  for (const [time, message] of [['08:10:00', STEP], ['20:44:00', STEP], ['07:45:00', RANGE], ['21:00:00', RANGE], ['07:30:00', RANGE]]) {
    const { settings, calls } = settingsHook();
    assert.equal(await settings.upsertPreference('morning_checkin', true, time), message, time);
    assert.deepEqual(calls, [], `${time} is not saved`);
  }
});

test('valid reminder times are saved exactly as chosen, including both boundaries', async () => {
  for (const time of ['08:00:00', '08:15:00', '13:30:00', '20:45:00']) {
    const { settings, calls } = settingsHook();
    assert.equal(await settings.upsertPreference('morning_checkin', true, time), null, time);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].table, 'notification_preferences');
    assert.equal(calls[0].row.send_time, time, 'never silently changed');
    assert.equal(calls[0].row.enabled, true);
  }
  // No time yet: the existing 08:00 default still applies.
  const { settings, calls } = settingsHook();
  assert.equal(await settings.upsertPreference('morning_checkin', true, null), null);
  assert.equal(calls[0].row.send_time, '08:00:00');
});

test('turning the reminder off preserves its saved time, even a legacy unsupported one', async () => {
  for (const time of ['07:30:00', '08:10:00', '09:15:00']) {
    const { settings, calls } = settingsHook();
    assert.equal(await settings.upsertPreference('morning_checkin', false, time), null, time);
    assert.equal(calls[0].row.send_time, time); assert.equal(calls[0].row.enabled, false);
  }
});

test('other timed notification types keep their existing unrestricted times', async () => {
  for (const [type, time] of [['journal_prompt', '20:10:00'], ['workout_window', '06:05:00'], ['bedtime_story', '19:20:00']]) {
    const { settings, calls } = settingsHook();
    assert.equal(await settings.upsertPreference(type, true, time), null, type);
    assert.equal(calls[0].row.send_time, time, type);
  }
});

test('the reminder uses the 15-minute list on every platform; the native picker is only for other types', () => {
  const screen = read('screens/subscreens/NotificationSettingsScreen.tsx');
  const listBranch = screen.indexOf("{pickerType === 'morning_checkin' ? <ScrollView");
  const nativeBranch = screen.indexOf('<DateTimePicker');
  assert.ok(listBranch > 0 && nativeBranch > listBranch, 'reminder list is checked before the native picker');
  const branch = screen.slice(listBranch, nativeBranch);
  assert.match(branch, /REMINDER_TIMES\.map\(\(time\) => \{/);
  assert.doesNotMatch(branch, /Platform\.OS/, 'same list on iOS and Android');
  assert.match(branch, /onPress=\{\(\) => \{ setPickerType\(null\); void saveTime\('morning_checkin', timeToDate\(time\)\); \}\}/);
  assert.match(branch, /\{time\.slice\(0, 5\)\}/);
  assert.match(screen, /import \{ REMINDER_TIMES \} from '\.\.\/\.\.\/lib\/reminderTime';/);
  // The legacy 07:30 explanation and the saved-time display are unchanged.
  assert.match(screen, /Your saved 07:30 reminder arrives at 08:00, outside quiet hours\. Choose a new time to update your preference\./);
  const hook = read('hooks/useNotificationSettings.ts');
  assert.match(hook, /if \(enabled && type === 'morning_checkin' && sendTime !== null\) \{\s*const invalid = reminderTimeError\(sendTime\);\s*if \(invalid\) return Promise\.resolve\(invalid\);/);
});
