export const MIND_JOURNAL_PROMPTS: {
  low: readonly [string, string, string];
  positive: readonly [string, string, string];
  neutral: readonly [string, string, string];
};

export const TEXT_A_MATE_DRAFT: string;

export type CheckInAnswers = {
  mood_value?: number | null;
  energy_level?: number | null;
  connection_level?: number | null;
};

export function selectMindJournalPrompts(checkIn?: CheckInAnswers | null): readonly [string, string, string];
export function localDateKey(date?: Date): string;
