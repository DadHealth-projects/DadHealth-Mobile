// TEMPORARY: Remove this module and the marked Notification Settings block
// after TestFlight OneSignal subscription registration has been diagnosed.

export type OneSignalDebugState = {
  sdkInitialized: boolean;
  nativeModuleAvailable: boolean;
  permissionGranted: boolean;
  subscriptionOptedIn: boolean;
  hasSubscriptionId: boolean;
  externalUserLinked: boolean;
  latestError: string | null;
};

type SafeOneSignalError = {
  name: string;
  message: string;
  code?: string | number;
};

let state: OneSignalDebugState = {
  sdkInitialized: false,
  nativeModuleAvailable: false,
  permissionGranted: false,
  subscriptionOptedIn: false,
  hasSubscriptionId: false,
  externalUserLinked: false,
  latestError: null,
};

const listeners = new Set<() => void>();

export function getOneSignalDebugState() {
  return state;
}

export function subscribeOneSignalDebug(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateOneSignalDebug(patch: Partial<OneSignalDebugState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function recordOneSignalDebugError(stage: string, error: unknown): SafeOneSignalError {
  const safeError = toSafeError(error);
  const code = safeError.code == null ? '' : ` [${sanitize(String(safeError.code))}]`;
  updateOneSignalDebug({ latestError: `${sanitize(stage)}:${code} ${safeError.message}`.trim() });
  return safeError;
}

export function recordOneSignalDebugMessage(stage: string, message: string) {
  updateOneSignalDebug({ latestError: `${sanitize(stage)}: ${sanitize(message)}` });
}

function toSafeError(error: unknown): SafeOneSignalError {
  if (error instanceof Error) {
    const code = 'code' in error && (typeof error.code === 'string' || typeof error.code === 'number')
      ? error.code
      : undefined;
    return { name: sanitize(error.name), message: sanitize(error.message), code };
  }
  return { name: 'UnknownError', message: 'An unknown integration error occurred.' };
}

function sanitize(value: string) {
  return value
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[redacted]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[redacted]')
    .replace(/\b[A-Za-z0-9+/_=-]{48,}\b/g, '[redacted]')
    .slice(0, 180);
}
