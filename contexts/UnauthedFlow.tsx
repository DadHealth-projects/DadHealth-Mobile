import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BiometricGate from '../components/BiometricGate';
import Splash from '../components/Splash';
import LoginScreen from '../screens/LoginScreen';
import { useAuth } from './AuthContext';
import { hasBiometricCredentials, isBiometricAvailable } from '../lib/biometric';
import { colors } from '../theme';

type Mode = 'checking' | 'biometric' | 'login';

type UnauthedStackParamList = { Login: undefined };
const Stack = createNativeStackNavigator<UnauthedStackParamList>();

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
  const { manualSignOut } = useAuth();
  const [mode, setMode] = useState<Mode>('checking');

  useEffect(() => {
    let active = true;
    (async () => {
      // After an EXPLICIT Log Out, skip the biometric auto-prompt and land on
      // the Login screen. Otherwise the stored Face ID creds silently re-login
      // the user and they bounce straight back to Home (the "logout → home"
      // loop). Fresh launches still get the biometric gate.
      if (manualSignOut) {
        setMode('login');
        return;
      }

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
  }, [manualSignOut]);

  if (mode === 'checking') return <Splash />;
  if (mode === 'biometric') return <BiometricGate onFallback={() => setMode('login')} />;
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.dark },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
