export function refreshAfterInFlight(
  inFlightByUser: Map<string, Promise<unknown>>,
  userId: string,
  refresh: (userId: string) => Promise<void>,
): Promise<void>;
