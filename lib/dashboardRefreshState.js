const ENTITLEMENT_FIELDS = [
  'isPro',
  'trialActive',
  'freezeUsedThisWeek',
  'freezesRemaining',
];

const SCORE_FIELDS = [
  'mindScore',
  'bodyScore',
  'bondScore',
  'mindWeekChange',
  'bodyWeekChange',
  'bondWeekChange',
  'baselineAvailable',
  'scoreError',
  'totalScore',
  'weakestPillar',
  'recommendedAction',
];

/** Keep the last same-account server snapshot for reads that failed this refresh. */
function mergeDashboardRefreshState(userId, previousUserId, previous, next, failedReads) {
  if (!userId || userId !== previousUserId || !previous) return next;

  const merged = { ...next };
  const preserve = (fields) => {
    for (const field of fields) merged[field] = previous[field];
  };

  if (failedReads.mood) preserve(['moodLogs', 'checkedInToday']);
  if (failedReads.streak) preserve(['streak']);
  if (failedReads.entitlement) preserve(ENTITLEMENT_FIELDS);
  if (failedReads.score) preserve(SCORE_FIELDS);

  return merged;
}

module.exports = { mergeDashboardRefreshState };
