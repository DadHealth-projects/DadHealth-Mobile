export type CheckInAction = 'breathing' | 'journal' | 'bond' | 'body' | 'support';

export type CheckInRecommendation = {
  primary: {
    state: string;
    recommendation: string;
    action: { label: string; action: CheckInAction };
  };
};

export function checkInRecommendation(
  moodValue: number,
  stressLevel: number | null,
  energyLevel: number | null,
  connectionLevel: number | null,
): CheckInRecommendation;
