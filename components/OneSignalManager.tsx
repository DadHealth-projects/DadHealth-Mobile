import { useEffect } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { initializePushNotifications, loginPushUser, logoutPushUser } from '../lib/pushNotifications';

export default function OneSignalManager() {
  const { user } = useAuth();
  useEffect(() => { initializePushNotifications(); }, []);
  useEffect(() => {
    if (user?.id) loginPushUser(user.id);
    else logoutPushUser();
  }, [user?.id]);
  return null;
}
