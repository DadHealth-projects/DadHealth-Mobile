import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { readOfflineQueue } from '../lib/offlineStorage';
import { setOfflineSyncUser, syncOfflineQueue } from '../lib/offlineSync';

const OFFLINE_NOTICE_DELAY_MS = 1500;

export default function OfflineSyncManager() {
  const { user } = useAuth();
  const {
    isOffline,
    isKnown,
    showCaughtUpNotice,
    showOfflineNotice,
    showSyncingNotice,
  } = useNetworkStatus();
  const userId = user?.id ?? null;
  const confirmedOffline = useRef(false);
  const offlineNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    if (!userId || !isKnown || isOffline) return;
    await syncOfflineQueue(userId);
  }, [isKnown, isOffline, userId]);

  useEffect(() => {
    setOfflineSyncUser(userId);
    return () => {
      if (userId) setOfflineSyncUser(null);
    };
  }, [userId]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (!isKnown) return;
    if (isOffline) {
      if (confirmedOffline.current || offlineNoticeTimer.current) return;
      offlineNoticeTimer.current = setTimeout(() => {
        offlineNoticeTimer.current = null;
        confirmedOffline.current = true;
        showOfflineNotice();
      }, OFFLINE_NOTICE_DELAY_MS);
      return () => {
        if (offlineNoticeTimer.current) {
          clearTimeout(offlineNoticeTimer.current);
          offlineNoticeTimer.current = null;
        }
      };
    }

    if (offlineNoticeTimer.current) {
      clearTimeout(offlineNoticeTimer.current);
      offlineNoticeTimer.current = null;
    }
    if (!confirmedOffline.current) return;
    confirmedOffline.current = false;

    showSyncingNotice();
    let active = true;
    void (async () => {
      try {
        await sync();
        if (!active || !userId) return;
        const remaining = await readOfflineQueue(userId);
        if (active && remaining.length === 0) showCaughtUpNotice();
      } catch {
        // Item-level sync state remains the source of truth when a retry cannot finish.
      }
    })();
    return () => { active = false; };
  }, [isKnown, isOffline, showCaughtUpNotice, showOfflineNotice, showSyncingNotice, sync, userId]);

  useEffect(() => () => {
    if (offlineNoticeTimer.current) clearTimeout(offlineNoticeTimer.current);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return null;
}
