/**
 * Applies settled authentication identity changes to OneSignal.
 * While auth is loading, the current user value may be temporary and is ignored.
 */
export function createOneSignalAuthLifecycle(login, logout) {
  let previousSettledUserId = null;

  return {
    update(loading, userId) {
      if (loading) return;

      const nextUserId = userId ?? null;
      if (nextUserId === previousSettledUserId) return;

      const previousUserId = previousSettledUserId;
      // Store before calling native code so React effect replays do not repeat it.
      previousSettledUserId = nextUserId;

      if (nextUserId) login(nextUserId);
      else if (previousUserId) logout();
    },
  };
}
