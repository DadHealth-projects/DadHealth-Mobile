import { useEffect, useRef } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { initializePushNotifications, loginPushUser, logoutPushUser } from '../lib/pushNotifications';
import { createOneSignalAuthLifecycle } from '../lib/oneSignalAuthLifecycle';

export default function OneSignalManager() {
  const { user, loading } = useAuth();
  const authLifecycle = useRef<ReturnType<typeof createOneSignalAuthLifecycle> | null>(null);
  if (!authLifecycle.current) {
    authLifecycle.current = createOneSignalAuthLifecycle(loginPushUser, logoutPushUser);
  }

  useEffect(() => { initializePushNotifications(); }, []);

  useEffect(() => {
    authLifecycle.current?.update(loading, user?.id ?? null);
  }, [loading, user?.id]);

  return null;
}
