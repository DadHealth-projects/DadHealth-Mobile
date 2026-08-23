import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type OfflineAction = 'community_post' | 'community_thread' | 'community_update' | 'dad_days_search' | 'dad_days_save' | 'weekly_challenge' | 'present_dad';

export type ConnectivityToast = {
  id: number;
  message: string;
  tone: 'offline' | 'online' | 'neutral';
};

type NetworkContextValue = {
  isOffline: boolean;
  isKnown: boolean;
  toast: ConnectivityToast | null;
  showOfflineNotice: () => void;
  showSyncingNotice: () => void;
  showCaughtUpNotice: () => void;
  showOfflineAction: (action: OfflineAction) => void;
  showErrorNotice: (message: string) => void;
};

const OFFLINE_ACTION_MESSAGES: Record<OfflineAction, string> = {
  community_post: 'Reconnect to post or respond.',
  community_thread: 'Reconnect to open this conversation.',
  community_update: 'Reconnect to update Community content.',
  dad_days_search: 'Dad Days search needs an internet connection. Reconnect and try again.',
  dad_days_save: 'Reconnect to save this Dad Day.',
  weekly_challenge: 'Weekly Challenge updates need an internet connection. Reconnect and try again.',
  present_dad: 'Present Dad Mode needs an internet connection. Reconnect and try again.',
};

const NetworkContext = createContext<NetworkContextValue>({
  isOffline: false,
  isKnown: false,
  toast: null,
  showOfflineNotice: () => undefined,
  showSyncingNotice: () => undefined,
  showCaughtUpNotice: () => undefined,
  showOfflineAction: () => undefined,
  showErrorNotice: () => undefined,
});

function offlineFrom(state: NetInfoState | null) {
  return state?.isConnected === false || state?.isInternetReachable === false;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NetInfoState | null>(null);
  const [toast, setToast] = useState<ConnectivityToast | null>(null);
  const toastId = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    void NetInfo.fetch().then((initial) => { if (active) setState(initial); });
    const unsubscribe = NetInfo.addEventListener(setState);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  const showToast = useCallback((message: string, tone: ConnectivityToast['tone']) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    const id = ++toastId.current;
    setToast({ id, message, tone });
    dismissTimer.current = setTimeout(() => {
      setToast((current) => current?.id === id ? null : current);
      dismissTimer.current = null;
    }, 4000);
  }, []);

  const showOfflineNotice = useCallback(() => {
    showToast("You're offline. Some features may be unavailable.", 'offline');
  }, [showToast]);
  const showSyncingNotice = useCallback(() => {
    showToast('Back online — syncing changes…', 'online');
  }, [showToast]);
  const showCaughtUpNotice = useCallback(() => {
    showToast('All caught up', 'online');
  }, [showToast]);
  const showOfflineAction = useCallback((action: OfflineAction) => {
    showToast(OFFLINE_ACTION_MESSAGES[action], 'neutral');
  }, [showToast]);
  const showErrorNotice = useCallback((message: string) => {
    showToast(message, 'neutral');
  }, [showToast]);

  const value = useMemo(() => ({
    isOffline: offlineFrom(state),
    isKnown: state !== null,
    toast,
    showOfflineNotice,
    showSyncingNotice,
    showCaughtUpNotice,
    showOfflineAction,
    showErrorNotice,
  }), [showCaughtUpNotice, showErrorNotice, showOfflineAction, showOfflineNotice, showSyncingNotice, state, toast]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
