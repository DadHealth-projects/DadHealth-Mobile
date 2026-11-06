export type OneSignalAuthLifecycle = {
  update: (loading: boolean, userId: string | null) => void;
};

export function createOneSignalAuthLifecycle(
  login: (userId: string) => void,
  logout: () => void,
): OneSignalAuthLifecycle;
