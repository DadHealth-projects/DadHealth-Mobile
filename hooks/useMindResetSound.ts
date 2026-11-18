import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSoundPreferences } from '../lib/mindResetSound';

const preferences = createSoundPreferences(AsyncStorage);
export function useMindResetSound(owner?: string) {
  const sound = useSyncExternalStore(preferences.subscribe, () => preferences.get(owner));
  const [state, setState] = useState({ owner, ready: false, error: false });
  const epoch = useRef(0);
  const currentOwner = useRef(owner); currentOwner.current = owner;
  useEffect(() => {
    let current = true;
    if (owner) void preferences.load(owner).then(
      () => { if (current) setState({ owner, ready: true, error: false }); },
      () => { if (current) setState({ owner, ready: true, error: true }); },
    );
    return () => { current = false; epoch.current++; };
  }, [owner]);
  return {
    sound, ready: state.owner === owner && state.ready,
    error: state.owner === owner && state.error,
    setSound: (on: boolean) => {
      if (!owner || currentOwner.current !== owner) return;
      const request = epoch.current;
      const settle = (error: boolean) => {
        if (request === epoch.current && currentOwner.current === owner) setState({ owner, ready: true, error });
      };
      void preferences.set(owner, on).then(
        () => settle(false),
        () => settle(true),
      );
    },
  };
}
