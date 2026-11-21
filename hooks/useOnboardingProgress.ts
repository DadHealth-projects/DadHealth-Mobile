import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { readOwnerSecret, writeOwnerSecret } from '../lib/accountPrivacyCleanup';
export type SetupChoices = { goals: string[]; custody: string | null; ages: string[] };
const empty: SetupChoices = { goals: [], custody: null, ages: [] };
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
export default function useOnboardingProgress(owner?: string) {
  const current = useRef(owner); current.current = owner;
  const [state, setState] = useState({ owner, choices: empty, ready: false, error: '' });
  const choices = useRef(empty);
  const alive = useRef(true);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  useEffect(() => {
    if (!owner || state.owner !== owner || state.ready) return;

    let connected: boolean | null = null;

    const app = AppState.addEventListener('change', next => {
      if (next === 'active') {
        setRestoreAttempt(value => value + 1);
      }
    });

    const network = NetInfo.addEventListener(next => {
      const online =
        next.isConnected === true &&
        next.isInternetReachable !== false;

      if (online && connected === false) {
        setRestoreAttempt(value => value + 1);
      }

      connected = online;
    });

    return () => {
      app.remove();
      network();
    };
  }, [owner, state.owner, state.ready]);
  useEffect(() => {
    let active = true; alive.current = true;
    choices.current = empty;
    setState({ owner, choices: empty, ready: false, error: '' });
    if (!owner) return;
    const valid = () => active && current.current === owner;
    void (async () => {
      try {
        const [profile, raw] = await Promise.all([
          supabase.from('user_profile').select('goals,custody_pattern,kids_ages').eq('user_id', owner).maybeSingle(),
          readOwnerSecret(owner, `dadhealth.setup.${owner}`, valid),
        ]);
        if (profile.error) throw profile.error;
        let draft: Partial<SetupChoices> = {};
        try { draft = JSON.parse(raw ?? '{}'); } catch { /* Corrupt draft cannot replace saved profile. */ }
        const p = profile.data;
        const restored = {
          goals: strings(draft?.goals) ? draft.goals : strings(p?.goals) ? p.goals : [],
          custody: typeof draft?.custody === 'string' ? draft.custody : p?.custody_pattern ?? null,
          ages: strings(draft?.ages) ? draft.ages : strings(p?.kids_ages) ? p.kids_ages : [],
        };
        if (valid()) { choices.current = restored; setState({ owner, choices: restored, ready: true, error: '' }); }
      } catch { if (valid()) setState(s => ({ ...s, error: 'We couldn’t restore your setup. We’ll try again when you reconnect or return to the app.' })); }
    })();
    return () => { active = false; alive.current = false; };
  }, [owner, restoreAttempt]);
  function change(patch: Partial<SetupChoices>) {
    if (!owner || current.current !== owner || state.owner !== owner || !state.ready) return;
    const next = { ...choices.current, ...patch };
    choices.current = next;
    setState({ owner, choices: next, ready: true, error: '' });
    void writeOwnerSecret(owner, `dadhealth.setup.${owner}`, JSON.stringify(next), () => current.current === owner)
      .catch(() => { if (alive.current && current.current === owner) setState(s => ({ ...s, error: 'Your latest choices haven’t been saved on this device yet.' })); });
  }
  return { choices: state.owner === owner ? state.choices : empty, ready: state.owner === owner && state.ready,
    error: state.owner === owner ? state.error : '', change };
}
