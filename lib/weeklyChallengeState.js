function isCurrentWeeklyChallengeContext(expected, current) {
  return expected?.challengeId === current?.challengeId
    && expected?.userId === current?.userId;
}

function deriveWeeklyChallengeParticipationState({
  challengeId,
  userId,
  expectedChallengeId,
  expectedUserId,
  joined,
  completedAt,
  locallyStarted,
}) {
  if (
    !joined
    || challengeId !== expectedChallengeId
    || userId !== expectedUserId
  ) {
    return 'not_joined';
  }
  if (completedAt) return 'completed';
  return locallyStarted ? 'started' : 'joined';
}

function isCurrentWeeklyChallengeRequest(requestId, currentRequestId, requestContext, currentContext) {
  return requestId === currentRequestId
    && isCurrentWeeklyChallengeContext(requestContext, currentContext);
}

module.exports = {
  deriveWeeklyChallengeParticipationState,
  isCurrentWeeklyChallengeContext,
  isCurrentWeeklyChallengeRequest,
};
