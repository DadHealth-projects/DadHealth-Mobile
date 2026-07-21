import React, { useEffect, useState } from 'react';

import BiometricGate from '../components/BiometricGate';
import Splash from '../components/Splash';
import LoginScreen from '../screens/LoginScreen';
import { hasBiometricCredentials, isBiometricAvailable } from '../lib/biometric';

type Mode = 'checking' | 'biometric' | 'login';

/**
 * The signed-out experience. Instead of always showing the login form, it copies
 * the "banking app" pattern: if the user previously enabled biometric login and
 * the device supports it, we go straight to the biometric gate (which auto-prompts
 * Face ID / Touch ID). The login form is the LAST fallback — shown only when
 * biometrics are unavailable/unenrolled, or the user chooses "Use password".
 *
 * This mounts fresh whenever there is no session, so it also drives the
 * post-logout flow (logout clears the session → this re-runs → auto biometric).
 */
export default function UnauthedFlow() {
  const [mode, setMode] = useState<Mode>('checking');

  useEffect(() => {
    let active = true;
    (async () => {
      const [available, hasCreds] = await Promise.all([
        isBiometricAvailable(),
        hasBiometricCredentials(),
      ]);
      if (!active) return;
      setMode(available && hasCreds ? 'biometric' : 'login');
    })();
    return () => {
      active = false;
    };
  }, []);

  if (mode === 'checking') return <Splash />;
  if (mode === 'biometric') return <BiometricGate onFallback={() => setMode('login')} />;
  return <LoginScreen />;
}
