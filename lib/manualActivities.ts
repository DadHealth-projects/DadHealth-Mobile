import { supabase } from './supabase';

export type ManualActivityPillar = 'body' | 'bond' | 'mind';

export const MANUAL_ACTIVITY_OPTIONS = {
  body: [{ value: 'crossfit', label: 'CrossFit' }, { value: 'running', label: 'Running' }, { value: 'cycling', label: 'Cycling' }, { value: 'football', label: 'Football' }, { value: 'gym', label: 'Gym' }, { value: 'yoga', label: 'Yoga' }, { value: 'swimming', label: 'Swimming' }, { value: 'walking', label: 'Walking' }, { value: 'hiit', label: 'HIIT' }, { value: 'rugby', label: 'Rugby' }, { value: 'tennis', label: 'Tennis' }, { value: 'martial_arts', label: 'Martial arts' }, { value: 'other', label: 'Other' }],
  bond: {
    routine: [{ value: 'school_run', label: 'School run' }, { value: 'bedtime_routine', label: 'Bedtime routine' }, { value: 'bath_time', label: 'Bath time' }, { value: 'homework_help', label: 'Homework help' }],
    play: [{ value: 'garden_play', label: 'Garden play' }, { value: 'board_games', label: 'Board games' }, { value: 'lego', label: 'Lego' }, { value: 'drawing', label: 'Drawing' }, { value: 'imaginative_play', label: 'Imaginative play' }],
    active: [{ value: 'bike_ride', label: 'Bike ride' }, { value: 'walk', label: 'Walk' }, { value: 'kick_about', label: 'Kick about' }, { value: 'swimming', label: 'Swimming' }, { value: 'park', label: 'Park' }, { value: 'mini_partners', label: 'Mini Partners session' }],
    out_and_about: [{ value: 'day_trip', label: 'Day trip' }, { value: 'cinema', label: 'Cinema' }, { value: 'restaurant', label: 'Restaurant' }, { value: 'match_or_game', label: 'Match or game' }],
    remote: [{ value: 'phone_call', label: 'Phone call' }, { value: 'facetime', label: 'FaceTime' }, { value: 'voice_note', label: 'Voice note' }, { value: 'shared_photo', label: 'Shared photo' }],
    other: [{ value: 'other', label: 'Other' }],
  },
  mind: {
    professional_support: [{ value: 'therapy', label: 'Therapy' }, { value: 'counselling', label: 'Counselling' }, { value: 'cbt_session', label: 'CBT session' }, { value: 'group_therapy', label: 'Group therapy' }],
    mindfulness: [{ value: 'meditation', label: 'Meditation' }, { value: 'mindfulness', label: 'Mindfulness' }, { value: 'gratitude_practice', label: 'Gratitude practice' }],
    social_connection: [{ value: 'met_a_friend', label: 'Met a friend' }, { value: 'called_family', label: 'Called family' }, { value: 'honest_conversation', label: 'Had an honest conversation' }],
    nature_recovery: [{ value: 'time_outdoors', label: 'Time outdoors' }, { value: 'rest_day', label: 'Rest day' }, { value: 'sleep_catch_up', label: 'Sleep catch-up' }],
    other: [{ value: 'other', label: 'Other' }],
  },
} as const;

export const MANUAL_ACTIVITY_CATEGORIES = {
  bond: [
    { value: 'routine', label: 'Routine' },
    { value: 'play', label: 'Play' },
    { value: 'active', label: 'Active' },
    { value: 'out_and_about', label: 'Out & about' },
    { value: 'remote', label: 'Remote' },
    { value: 'other', label: 'Other' },
  ],
  mind: [
    { value: 'professional_support', label: 'Professional support' },
    { value: 'mindfulness', label: 'Mindfulness' },
    { value: 'social_connection', label: 'Social connection' },
    { value: 'nature_recovery', label: 'Nature & recovery' },
    { value: 'other', label: 'Other' },
  ],
} as const;

export type ManualActivityRow = {
  id: string;
  user_id: string;
  pillar: ManualActivityPillar;
  category: string | null;
  activity_type: string;
  other_activity_text: string | null;
  duration_minutes: number | null;
  intensity: 'light' | 'moderate' | 'hard' | null;
  contact_day: boolean | null;
  notes: string | null;
  activity_date: string;
  logged_at: string;
  backdated_at: string | null;
};

const ALL_ACTIVITY_OPTIONS = [
  ...MANUAL_ACTIVITY_OPTIONS.body,
  ...Object.values(MANUAL_ACTIVITY_OPTIONS.bond).flat(),
  ...Object.values(MANUAL_ACTIVITY_OPTIONS.mind).flat(),
];

export function manualActivityLabel(activity: Pick<ManualActivityRow, 'activity_type' | 'other_activity_text'>): string {
  if (activity.activity_type === 'other') return activity.other_activity_text?.trim() || 'Other activity';
  return ALL_ACTIVITY_OPTIONS.find((option) => option.value === activity.activity_type)?.label
    ?? activity.activity_type.replaceAll('_', ' ');
}

export type ManualActivityDraft = {
  pillar: ManualActivityPillar;
  category: string | null;
  activityType: string;
  otherText: string;
  durationMinutes: number | null;
  intensity: 'light' | 'moderate' | 'hard' | null;
  contactDay: boolean | null;
  notes: string;
  activityDate: string;
};

export function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDateKey(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function dateKeyToPickerDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function pickerDateToKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function validateManualActivity(draft: ManualActivityDraft): string | null {
  if (!draft.activityType) return 'Choose an activity.';
  if (draft.activityType === 'other' && !draft.otherText.trim()) return 'Add a short description for Other.';
  if (draft.pillar === 'body' && (!Number.isInteger(draft.durationMinutes) || (draft.durationMinutes ?? 0) < 1)) return 'Enter the workout duration in minutes.';
  if (draft.pillar === 'body' && !draft.intensity) return 'Choose the workout intensity.';
  if (draft.pillar === 'mind' && (!Number.isInteger(draft.durationMinutes) || (draft.durationMinutes ?? 0) < 1)) return 'Enter the activity duration in minutes.';
  if (draft.pillar === 'bond' && draft.durationMinutes != null && (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 1)) return 'Enter a valid duration in minutes.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.activityDate)) return 'Choose a valid activity date.';
  return null;
}

export async function fetchManualActivityHistory(userId: string, pillar: ManualActivityPillar) {
  const { data, error } = await supabase.from('activity_logs')
    .select('id,user_id,pillar,category,activity_type,other_activity_text,duration_minutes,intensity,contact_day,notes,activity_date,logged_at,backdated_at')
    .eq('user_id', userId).eq('pillar', pillar)
    .order('activity_date', { ascending: false }).order('logged_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ManualActivityRow[];
}

export async function createManualActivity(userId: string, clientRequestId: string, draft: ManualActivityDraft) {
  const validation = validateManualActivity(draft);
  if (validation) throw new Error(validation);
  const payload = {
    user_id: userId,
    client_request_id: clientRequestId,
    pillar: draft.pillar,
    category: draft.category,
    activity_type: draft.activityType,
    other_activity_text: draft.activityType === 'other' ? draft.otherText.trim() : null,
    duration_minutes: draft.durationMinutes,
    intensity: draft.pillar === 'body' ? draft.intensity : null,
    contact_day: draft.pillar === 'bond' ? Boolean(draft.contactDay) : null,
    notes: draft.notes.trim() || null,
    activity_date: draft.activityDate,
  };
  const inserted = await supabase.from('activity_logs').insert(payload).select('id').maybeSingle();
  if (!inserted.error) return;
  if (inserted.error.code !== '23505') throw inserted.error;

  // Replaying the same client request after a lost response is success, not a
  // second activity. A different request id remains a distinct user log.
  const existing = await supabase.from('activity_logs').select('id')
    .eq('user_id', userId).eq('client_request_id', clientRequestId).maybeSingle();
  if (existing.error || !existing.data) throw inserted.error;
}

type Listener = () => void;
const historyListeners = new Set<Listener>();

export function subscribeManualActivityChanges(listener: Listener) {
  historyListeners.add(listener);
  return () => { historyListeners.delete(listener); };
}

export function notifyManualActivityChanged() {
  historyListeners.forEach((listener) => listener());
}
