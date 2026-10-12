exports.refreshAfterInFlight = async function refreshAfterInFlight(inFlightByUser, userId, refresh) {
  const activeRequest = inFlightByUser.get(userId);
  if (activeRequest) {
    try {
      await activeRequest;
    } catch {
      // Always allow the explicit post-save refresh to make a fresh request.
    }
  }
  return refresh(userId);
};
