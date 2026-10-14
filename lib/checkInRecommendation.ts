/**
 * The free recommendation shown straight after the daily check-in. Historic
 * check-ins may still include Stress; new check-ins fall back to Mood.
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
 * @param moodValue 1–5, as selected by the current check-in.
 * @param stressLevel 1–5 when present on a historical/current record; null
 *   uses Mood as the fallback for the new check-in.
 */
export function checkInRecommendation(
  moodValue: number,
  stressLevel: number | null,
): CheckInRecommendation {
  if (stressLevel !== null && stressLevel >= 4) {
    return {
      state: "You're feeling stressed today.",
      recommendation: 'Take a five-minute Mind Reset before anything else.',
      actionLabel: 'Start Mind Reset',
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
      recommendation: 'A five-minute Mind Reset will give you space to settle.',
      actionLabel: 'Start Mind Reset',
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
