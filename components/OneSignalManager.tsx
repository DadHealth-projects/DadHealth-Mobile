import { useEffect } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { recordOneSignalDebugError } from '../lib/oneSignalDebug';
import { initializePushNotifications, loginPushUser, logoutPushUser } from '../lib/pushNotifications';

export default function OneSignalManager() {
  const { user } = useAuth();

  useEffect(() => {
    console.info('[OneSignalDebug] Manager mounted');
    try {
      const initialized = initializePushNotifications();
      console.info('[OneSignalDebug] Manager initialization returned', { initialized });
    } catch (error) {
      console.error(
        '[OneSignalDebug] Manager initialization threw',
        recordOneSignalDebugError('Manager initialization', error),
      );
    }
    return () => console.info('[OneSignalDebug] Manager unmounted');
  }, []);

  useEffect(() => {
    try {
      if (user?.id) loginPushUser(user.id);
      else logoutPushUser();
    } catch (error) {
      console.error(
        '[OneSignalDebug] Auth synchronization threw',
        recordOneSignalDebugError('Auth synchronization', error),
      );
    }
  }, [user?.id]);
  return null;
}
