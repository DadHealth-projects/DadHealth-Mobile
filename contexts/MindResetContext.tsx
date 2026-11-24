import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { acquireAudio } from '../lib/audioOwnership';
import { createMindResetOwner } from '../lib/mindResetOwner';
import { useMindResetSound } from '../hooks/useMindResetSound';
import { recordMindResetCompletion } from '../lib/mindResetCompletion';

const Context = createContext<ReturnType<typeof createMindResetOwner> | null>(null);
// Root keys this provider by authenticated owner; screen mount/focus never owns audio.
export function MindResetProvider({ owner, children }: React.PropsWithChildren<{ owner?: string }>) {
  const [session] = useState(() => createMindResetOwner(
    () => createAudioPlayer(require('../assets/audio/mind-reset-provisional.wav'), { updateInterval: 200 }),
    async () => { if (!owner) throw new Error('Sign in to start Mind Reset'); return acquireAudio('reset'); },
    (activeSeconds) => { if (owner) void recordMindResetCompletion(owner, activeSeconds); },
  ));
  const preference = useMindResetSound(owner);
  useEffect(() => { session.setSound(preference.sound); }, [session, preference.sound]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') session.reconcile(); });
    return () => { subscription.remove(); session.dispose(); };
  }, [session]);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useMindResetSession() {
  const session = useContext(Context);
  if (!session) throw new Error('MindResetProvider is required');
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return { ...state, start: session.start, pause: session.pause, stop: session.end };
}
