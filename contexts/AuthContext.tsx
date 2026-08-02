import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import {
  isBiometricAvailable,
  hasBiometricCredentials,
  saveBiometricCredentials,
} from '../lib/biometric';
import { isOnboardingComplete } from '../lib/onboarding';

type AuthResult = { error: string | null };

// Where the emailed password-reset link should land. Mirrors the web
// (`/auth/callback?next=/auth/reset-password`) so mobile reuses the web reset UI.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://dadhealth.co.uk';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  /** True until the initial session has been hydrated from SecureStore. */
  loading: boolean;
  /**
   * Whether the signed-in user has completed Phase 1 onboarding.
   * `null` while unknown (no user, or the profile is still being fetched).
   */
  onboardingComplete: boolean | null;
  /**
   * True immediately after an EXPLICIT Log Out from the Account Sheet.
   * UnauthedFlow uses this to skip the biometric auto-prompt and go straight to
   * the Login screen — otherwise the stored Face ID creds silently re-log the
   * user in and they bounce straight back to Home (the "logout → home" loop).
   * Resets to false on the next successful manual sign-in, or when a session
   * arrives.
   */
  manualSignOut: boolean;
  /** Re-fetch onboarding status and report whether the new flow is complete. */
  refreshOnboarding: () => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** Send a password-reset email (same behaviour as the web AuthModal). */
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /**
   * Set (email only — never the password) after a successful password sign-in
   * when the device supports biometrics and none are enrolled yet. Non-null =>
   * the enrollment modal should offer to enable biometric login.
   */
  pendingBiometricEnrollment: { email: string } | null;
  /**
   * Resolve the enrollment prompt. `enable` true saves the just-used credentials
   * to the keychain (opt-in); either way the pending prompt is cleared.
   */
  completeBiometricEnrollment: (enable: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  onboardingComplete: null,
  manualSignOut: false,
  refreshOnboarding: async () => false,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  signOut: async () => {},
  pendingBiometricEnrollment: null,
  completeBiometricEnrollment: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [manualSignOut, setManualSignOut] = useState(false);
  // Credentials from the most recent successful password sign-in, held ONLY in
  // memory until the user accepts/declines the biometric enrollment prompt. Never
  // persisted unless they opt in. Cleared on decline and on sign-out.
  const [pendingEnrollment, setPendingEnrollment] = useState<{
    email: string;
    password: string;
  } | null>(null);

 useEffect(() => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, nextSession) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession) {
      setPendingEnrollment(null);
      setOnboardingComplete(null);
    } else {
      // Any real session (password or biometric sign-in) clears the manual
      // sign-out flag so the biometric gate returns on future launches.
      setManualSignOut(false);
    }

    setLoading(false);
  });

  return () => subscription.unsubscribe();
}, []);

  // Fetch onboarding status whenever the signed-in user changes. Kept separate
  // from the auth listener so it's a profile read, not an auth round-trip.
  const loadOnboarding = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_profile')
        .select('goals,custody_pattern,onboarding_complete')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      const complete = isOnboardingComplete(data);
      setOnboardingComplete(complete);
      return complete;
    } catch (error) {
      // Don't trap the user in a splash on a transient profile-read failure —
      // let them into the app and surface onboarding later if needed.
      console.warn(
        '[auth]',
        JSON.stringify({
          op: 'loadOnboarding',
          code: typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined,
          message: error instanceof Error ? error.message : String(error),
          details: typeof error === 'object' && error !== null && 'details' in error ? error.details : undefined,
          hint: typeof error === 'object' && error !== null && 'hint' in error ? error.hint : undefined,
        })
      );
      setOnboardingComplete(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setOnboardingComplete(null);
      return;
    }
    setOnboardingComplete(null);
    void loadOnboarding(userId);
  }, [user?.id, loadOnboarding]);

  const refreshOnboarding = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    return loadOnboarding(user.id);
  }, [user?.id, loadOnboarding]);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }, []);

 const signIn = useCallback(
  async (email: string, password: string): Promise<AuthResult> => {
    const trimmed = email.trim();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    setManualSignOut(false);

    try {
      const biometricAvailable = await isBiometricAvailable();
      const enrolled = await hasBiometricCredentials();

      if (biometricAvailable && !enrolled) {
        setPendingEnrollment({
          email: trimmed,
          password,
        });
      }
    } catch (e) {
      console.warn(
        '[auth]',
        JSON.stringify({
          op: 'biometric-check',
          message: e instanceof Error ? e.message : String(e),
        }),
      );
    }

    return { error: null };
  },
  [],
);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${WEB_URL}/auth/callback?next=/auth/reset-password`,
    });
    return { error: error?.message ?? null };
  }, []);

  const completeBiometricEnrollment = useCallback(
    async (enable: boolean) => {
      const creds = pendingEnrollment;
      setPendingEnrollment(null);
      if (enable && creds) {
        await saveBiometricCredentials(creds.email, creds.password);
      }
    },
    [pendingEnrollment]
  );

  const signOut = useCallback(async () => {
  setPendingEnrollment(null);
  // Flag that this is an EXPLICIT logout so UnauthedFlow lands on the Login
  // screen instead of auto-prompting Face ID (which would silently re-login
  // with the stored credentials and bounce the user straight back to Home).
  setManualSignOut(true);

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.warn(
      '[auth]',
      JSON.stringify({
        op: 'signOut',
        message: error.message,
      }),
    );
  }
}, []);

const value: AuthContextType = {
  user,
  session,
  loading,
  onboardingComplete,
  manualSignOut,
  refreshOnboarding,
  signUp,
  signIn,
  resetPassword,
  signOut,
  pendingBiometricEnrollment: pendingEnrollment
    ? { email: pendingEnrollment.email }
    : null,
  completeBiometricEnrollment,
};

return (
  <AuthContext.Provider value={value}>
    {children}
  </AuthContext.Provider>
)
};
