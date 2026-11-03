const AUTOMATIC_REFRESH_COALESCE_MS = 1000;

exports.shouldRefreshFitnessLibraryOnResume = function shouldRefreshFitnessLibraryOnResume({
  nextState,
  previousState,
  userId,
  enabled,
}) {
  return Boolean(enabled && userId && nextState === 'active' && previousState !== 'active');
};

exports.createFitnessLibraryRefreshGate = function createFitnessLibraryRefreshGate(now = Date.now) {
  let inFlight = null;
  let lastSource = null;
  let lastStartedAt = Number.NEGATIVE_INFINITY;

  return function runAutomaticRefresh(source, refresh) {
    if (inFlight) return inFlight;

    const startedAt = now();
    if (source !== lastSource && startedAt - lastStartedAt < AUTOMATIC_REFRESH_COALESCE_MS) {
      return Promise.resolve();
    }

    lastSource = source;
    lastStartedAt = startedAt;
    const request = Promise.resolve().then(refresh);
    inFlight = request.finally(() => {
      if (inFlight === trackedRequest) inFlight = null;
    });
    const trackedRequest = inFlight;
    return trackedRequest;
  };
};
