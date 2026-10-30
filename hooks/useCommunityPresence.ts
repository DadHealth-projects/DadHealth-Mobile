import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import { countUniquePresenceUsers } from '../lib/communityPresenceCount.mjs';

const COMMUNITY_PRESENCE_TOPIC = 'community:presence:v1';
const PRESENCE_SYNC_TIMEOUT_MS = 10_000;

export type CommunityPresence =
  | { status: 'loading' | 'unavailable'; count: null }
  | { status: 'available'; count: number };

type PresenceSnapshot = CommunityPresence & { userId: string | null };

const loadingPresence = (userId: string | null): PresenceSnapshot => ({
  userId,
  status: 'loading',
  count: null,
});

const toAppStateStatus = (state: string | null | undefined): AppStateStatus => (
  state === 'active' || state === 'background' || state === 'inactive' || state === 'extension' || state === 'unknown'
    ? state
    : 'unknown'
);

export function useCommunityPresence(userId?: string): CommunityPresence {
  const focused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(toAppStateStatus(AppState.currentState));
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>(loadingPresence(null));
  const authenticatedUserId = userId ?? null;
  const enabled = Boolean(authenticatedUserId && focused && appState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!authenticatedUserId) {
      setSnapshot({ userId: null, status: 'unavailable', count: null });
      return;
    }
    if (!enabled) {
      setSnapshot(loadingPresence(authenticatedUserId));
      return;
    }

    let active = true;
    let tracked = false;
    let synchronized = false;
    let syncTimeout: ReturnType<typeof setTimeout> | undefined;
    setSnapshot(loadingPresence(authenticatedUserId));

    const channel = supabase.channel(COMMUNITY_PRESENCE_TOPIC, {
      config: {
        private: true,
        presence: { key: authenticatedUserId },
      },
    });

    const publishSynchronizedCount = () => {
      if (!active || !tracked || !synchronized) return;
      const count = countUniquePresenceUsers(channel.presenceState());
      setSnapshot({
        userId: authenticatedUserId,
        status: 'available',
        count,
      });
    };

    channel.on('presence', { event: 'sync' }, () => {
      synchronized = true;
      if (syncTimeout) clearTimeout(syncTimeout);
      publishSynchronizedCount();
    });

    channel.subscribe((status) => {
      if (!active) return;
      if (status === 'SUBSCRIBED') {
        tracked = false;
        void channel.track({}).then((result) => {
          if (!active) return;
          if (result !== 'ok') {
            setSnapshot({ userId: authenticatedUserId, status: 'unavailable', count: null });
            return;
          }
          tracked = true;
          if (!synchronized) {
            syncTimeout = setTimeout(() => {
              if (active && !synchronized) {
                setSnapshot({ userId: authenticatedUserId, status: 'unavailable', count: null });
              }
            }, PRESENCE_SYNC_TIMEOUT_MS);
          }
          publishSynchronizedCount();
        }).catch(() => {
          if (active) setSnapshot({ userId: authenticatedUserId, status: 'unavailable', count: null });
        });
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        tracked = false;
        synchronized = false;
        setSnapshot({ userId: authenticatedUserId, status: 'unavailable', count: null });
      }
    });

    return () => {
      active = false;
      if (syncTimeout) clearTimeout(syncTimeout);
      void channel.untrack().catch(() => undefined);
      void supabase.removeChannel(channel);
    };
  }, [authenticatedUserId, enabled]);

  if (!authenticatedUserId) return { status: 'unavailable', count: null };
  if (!enabled || snapshot.userId !== authenticatedUserId) return { status: 'loading', count: null };
  return snapshot;
}
