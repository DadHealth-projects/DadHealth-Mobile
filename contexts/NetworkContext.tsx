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
  /** Connectivity only. The top toast never carries a feature error. */
  toast: ConnectivityToast | null;
  showOfflineNotice: () => void;
  showSyncingNotice: () => void;
  showCaughtUpNotice: () => void;
  showOfflineAction: (action: OfflineAction) => void;
  showErrorNotice: (message: string) => void;
  /** Feature/screen errors, rendered in the screen at the bottom. */
  screenError: string | null;
  reportScreenError: (id: string, message: string | null) => void;
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
  screenError: null,
  reportScreenError: () => undefined,
});

function offlineFrom(state: NetInfoState | null) {
  return state?.isConnected === false || state?.isInternetReachable === false;
}

/** How long a screen error stays on screen before it clears itself. */
const SCREEN_ERROR_MS = 5000;

type ScreenErrorEntry = { id: string; seq: number; message: string };

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NetInfoState | null>(null);
  const [toast, setToast] = useState<ConnectivityToast | null>(null);
  // One entry per reporter instance so several notices can coexist on a screen
  // without clearing each other. The oldest live message is the one shown.
  const [screenErrors, setScreenErrors] = useState<ScreenErrorEntry[]>([]);
  const toastId = useRef(0);
  const screenErrorSeq = useRef(0);
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

  const reportScreenError = useCallback((id: string, message: string | null) => {
    if (!message) {
      setScreenErrors((current) => current.some((entry) => entry.id === id)
        ? current.filter((entry) => entry.id !== id)
        : current);
      return;
    }
    const seq = ++screenErrorSeq.current;
    setScreenErrors((current) => {
      // Re-reporting the same text is a no-op, so a re-render never restarts
      // the dismissal timer and holds the error on screen.
      if (current.some((entry) => entry.id === id && entry.message === message)) return current;
      return [...current.filter((entry) => entry.id !== id), { id, seq, message }];
    });
  }, []);

  const activeScreenError = screenErrors[0] ?? null;
  const activeScreenErrorSeq = activeScreenError?.seq ?? null;

  // Errors clear themselves. Each one gets its own window, so a queued second
  // error still gets its full time once the first has gone.
  useEffect(() => {
    if (activeScreenErrorSeq == null) return undefined;
    const timer = setTimeout(() => {
      setScreenErrors((current) => current.filter((entry) => entry.seq !== activeScreenErrorSeq));
    }, SCREEN_ERROR_MS);
    return () => clearTimeout(timer);
  }, [activeScreenErrorSeq]);

  const screenError = activeScreenError?.message ?? null;

  const value = useMemo(() => ({
    isOffline: offlineFrom(state),
    isKnown: state !== null,
    toast,
    showOfflineNotice,
    showSyncingNotice,
    showCaughtUpNotice,
    showOfflineAction,
    showErrorNotice,
    screenError,
    reportScreenError,
  }), [reportScreenError, screenError, showCaughtUpNotice, showErrorNotice, showOfflineAction, showOfflineNotice, showSyncingNotice, state, toast]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
