/**
 * The free recommendation shown straight after the daily check-in — brief
 * Change 04, Moment 2: "You're feeling stressed today. [One useful free
 * recommendation]" followed by the Pro tease.
 *
 * Free members get one genuinely useful next step here, chosen from what they
 * just reported. That is what makes the Pro line beside it land: Pro is the
 * personalised plan, not the first piece of help.
 */

export type CheckInAction = 'breathing' | 'journal' | 'bond';

export type CheckInRecommendation = {
  /** Reflects back what the dad just reported. */
  state: string;
  /** Exactly one action. Never a list. */
  recommendation: string;
  actionLabel: string;
  action: CheckInAction;
};

/**
 * @param moodValue 1–4, as stored in `mood_logs.mood_value`.
 * @param stressLevel 1–5, as collected by the check-in panel.
 */
export function checkInRecommendation(
  moodValue: number,
  stressLevel: number | null,
): CheckInRecommendation {
  if (stressLevel !== null && stressLevel >= 4) {
    return {
      state: "You're feeling stressed today.",
      recommendation: 'Take a two-minute 4-4-4 breathing reset before anything else.',
      actionLabel: 'Start breathing',
      action: 'breathing',
    };
  }

  if (moodValue <= 2) {
    return {
      state: "Today's a low one.",
      recommendation: 'Write one line in your journal. Naming it is the part that helps.',
      actionLabel: 'Open journal',
      action: 'journal',
    };
  }

  if (stressLevel !== null && stressLevel === 3) {
    return {
      state: "You're carrying some tension today.",
      recommendation: 'A two-minute breathing reset will take the edge off.',
      actionLabel: 'Start breathing',
      action: 'breathing',
    };
  }

  return {
    state: "You're in a good place today.",
    recommendation: 'Use it — pick one intentional moment with your kids before bedtime.',
    actionLabel: 'Open Bond',
    action: 'bond',
  };
}
