import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type OfflineAction = 'community_post' | 'community_thread' | 'community_update' | 'dad_days_search' | 'dad_days_save' | 'weekly_challenge' | 'present_dad';

/**
 * Transient bottom snackbar. Used for temporary request failures and short
 * connectivity transitions. Never for form validation, which belongs inline
 * next to the field or action that produced it.
 */
export type ConnectivityToast = {
  id: number;
  message: string;
  tone: 'error' | 'online' | 'neutral';
};

/**
 * Persistent top status banner. Reserved for global conditions that stay true
 * until the device state changes — currently offline mode only.
 */
export type StatusBanner = {
  message: string;
  tone: 'offline';
};

type NetworkContextValue = {
  isOffline: boolean;
  isKnown: boolean;
  banner: StatusBanner | null;
  toast: ConnectivityToast | null;
  showSyncingNotice: () => void;
  showCaughtUpNotice: () => void;
  showOfflineAction: (action: OfflineAction) => void;
  showErrorNotice: (message: string) => void;
  screenError: string | null;
  reportScreenError: (id: string, message: string | null) => void;
  dismissToast: () => void;
};

const OFFLINE_BANNER_MESSAGE = "You're offline. Some features may be unavailable.";
const TOAST_DISMISS_MS = 4000;

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
  banner: null,
  toast: null,
  showSyncingNotice: () => undefined,
  showCaughtUpNotice: () => undefined,
  showOfflineAction: () => undefined,
  showErrorNotice: () => undefined,
  screenError: null,
  reportScreenError: () => undefined,
  dismissToast: () => undefined,
});

function offlineFrom(state: NetInfoState | null) {
  return state?.isConnected === false || state?.isInternetReachable === false;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NetInfoState | null>(null);
  const [toast, setToast] = useState<ConnectivityToast | null>(null);
  const [screenErrors, setScreenErrors] = useState<Record<string, string>>({});
  const toastId = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOffline = offlineFrom(state);

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

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearDismissTimer();
    setToast(null);
  }, [clearDismissTimer]);

  const showToast = useCallback((message: string, tone: ConnectivityToast['tone']) => {
    clearDismissTimer();
    const id = ++toastId.current;
    setToast({ id, message, tone });
    dismissTimer.current = setTimeout(() => {
      setToast((current) => current?.id === id ? null : current);
      dismissTimer.current = null;
    }, TOAST_DISMISS_MS);
  }, [clearDismissTimer]);

  // A connectivity change makes any pending failure notice stale.
  useEffect(() => {
    setToast((current) => current && current.tone !== 'online' ? null : current);
  }, [isOffline]);

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
    showToast(message, 'error');
  }, [showToast]);
  const reportScreenError = useCallback((id: string, message: string | null) => {
    setScreenErrors((current) => {
      const next = { ...current };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }, []);
  const screenError = Object.values(screenErrors)[0] ?? null;

  const value = useMemo(() => ({
    isOffline,
    isKnown: state !== null,
    banner: state !== null && isOffline ? { message: OFFLINE_BANNER_MESSAGE, tone: 'offline' as const } : null,
    toast,
    screenError,
    showSyncingNotice,
    showCaughtUpNotice,
    showOfflineAction,
    showErrorNotice,
    reportScreenError,
    dismissToast,
  }), [dismissToast, isOffline, reportScreenError, screenError, showCaughtUpNotice, showErrorNotice, showOfflineAction, showSyncingNotice, state, toast]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
