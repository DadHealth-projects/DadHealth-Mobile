const PRO_MOMENT_IDS = new Set([
  'score',
  'checkIn',
  'aiWorkout',
  'dadDays',
  'weeklyReport',
  'progressTrends',
  'dadDaysCounter',
]);

/** In-memory only: resets when the app process starts again. */
export function createUpgradeMomentSession() {
  const shown = new Set();
  let active = null;

  return {
    request(request) {
      if (!PRO_MOMENT_IDS.has(request.id)) return false;
      if (request.loading || request.isPro !== false || request.trialActive !== false) return false;
      if (request.featureAccess !== false || !request.hasCompletedAction) return false;
      if (shown.has(request.id) || active) return false;
      shown.add(request.id);
      active = request.screen;
      return true;
    },
    dismiss(screen) {
      if (active !== screen) return false;
      active = null;
      return true;
    },
    isShown(id) {
      return shown.has(id);
    },
    getActiveScreen() {
      return active;
    },
  };
}
