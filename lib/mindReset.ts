export const BREATHING_DURATION_SECONDS = 60;
export const RESET_STEP_DURATION_SECONDS = 48;
export const RESET_DURATION_SECONDS = RESET_STEP_DURATION_SECONDS * 5;
export const MIND_RESET_DURATION_SECONDS = BREATHING_DURATION_SECONDS + RESET_DURATION_SECONDS;

export const RESET_STEPS = [
  { title: 'Settle', instruction: 'Take a moment to settle. Let your breathing slow at a comfortable pace.' },
  { title: 'Release tension', instruction: 'Notice any physical tension. If it feels comfortable, relax your shoulders, jaw and hands.' },
  { title: 'Ground yourself', instruction: 'Notice what you can see, hear and feel around you.' },
  { title: 'Name what is here', instruction: 'Name what is taking up your attention, without judging it.' },
  { title: 'Choose one next step', instruction: 'Choose one small thing you can do next.' },
] as const;

export type MindResetPhase = 'breathing' | 'reset' | 'complete';

export function getMindResetPhase(elapsedSeconds: number): MindResetPhase {
  if (elapsedSeconds < BREATHING_DURATION_SECONDS) return 'breathing';
  if (elapsedSeconds < MIND_RESET_DURATION_SECONDS) return 'reset';
  return 'complete';
}

export function getMindResetStepIndex(elapsedSeconds: number): number | null {
  if (getMindResetPhase(elapsedSeconds) !== 'reset') return null;
  return Math.floor((elapsedSeconds - BREATHING_DURATION_SECONDS) / RESET_STEP_DURATION_SECONDS);
}
