export type WeeklyChallengeParticipationState = 'not_joined' | 'joined' | 'started' | 'completed';

export type WeeklyChallengeIdentity = {
  challengeId: string | null | undefined;
  userId: string | null | undefined;
};

export function isCurrentWeeklyChallengeContext(
  expected: WeeklyChallengeIdentity,
  current: WeeklyChallengeIdentity,
): boolean;

export function deriveWeeklyChallengeParticipationState(input: {
  challengeId: string | null | undefined;
  userId: string | null | undefined;
  expectedChallengeId: string;
  expectedUserId: string;
  joined: boolean;
  completedAt: string | null | undefined;
  locallyStarted: boolean;
}): WeeklyChallengeParticipationState;

export function isCurrentWeeklyChallengeRequest(
  requestId: number,
  currentRequestId: number,
  requestContext: WeeklyChallengeIdentity,
  currentContext: WeeklyChallengeIdentity,
): boolean;
