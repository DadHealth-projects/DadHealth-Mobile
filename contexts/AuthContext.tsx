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
  enrollBiometricCredential,
  isBiometricAvailable,
  hasBiometricCredentials,
} from '../lib/biometric';
import { isOnboardingComplete } from '../lib/onboarding';
import { logoutPushUser } from '../lib/pushNotifications';

type AuthResult = { error: string | null };

// Where the emailed password-reset link should land. Mirrors the web
// (`/auth/callback?next=/auth/reset-password`) so mobile reuses the web reset UI.
const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk')
  .replace(/^https:\/\/dadhealth\.co\.uk(?=\/|$)/, 'https://www.dadhealth.co.uk')
  .replace(/\/$/, '');

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
   * Resolve the existing enrollment prompt. `enable` registers a separately
   * revocable per-device credential; no password or copied session is stored.
   */
  completeBiometricEnrollment: (enable: boolean) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  onboardingComplete: null,
  refreshOnboarding: async () => false,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  signOut: async () => {},
  pendingBiometricEnrollment: null,
  completeBiometricEnrollment: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  // The enrollment prompt keeps only the email needed by the existing UI.
  // Device credentials are generated locally only after the user opts in.
  const [pendingEnrollment, setPendingEnrollment] = useState<{
    email: string;
  } | null>(null);

 useEffect(() => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession) {
      setPendingEnrollment(null);
      setOnboardingComplete(null);
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
    } catch {
      // Don't trap the user in a splash on a transient profile-read failure —
      // let them into the app and surface onboarding later if needed.
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
    return { error: error ? 'We could not create your account. Please try again.' : null };
  }, []);

 const signIn = useCallback(
  async (email: string, password: string): Promise<AuthResult> => {
    const trimmed = email.trim();

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });

    if (error) {
      return { error: 'Incorrect email or password.' };
    }

    try {
      const biometricAvailable = await isBiometricAvailable();
      const enrolled = await hasBiometricCredentials();

      if (biometricAvailable && !enrolled) {
        setPendingEnrollment({ email: trimmed });
      }
    } catch {}

    return { error: null };
  },
  [],
);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${WEB_URL}/auth/callback?next=/auth/reset-password`,
    });
    return { error: error ? 'We could not send the reset email. Please try again.' : null };
  }, []);

  const completeBiometricEnrollment = useCallback(
    async (enable: boolean) => {
      const creds = pendingEnrollment;

      if (!enable || !creds) {
        setPendingEnrollment(null);
        return { error: null };
      }

      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          return { error: 'Your sign-in session ended before biometric login could be enabled. Sign in again and retry.' };
        }

        const result = await enrollBiometricCredential(accessToken);
        if (!result.success) {
          return { error: result.error ?? 'Biometric login could not be enabled. Please try again.' };
        }

        setPendingEnrollment(null);
        return { error: null };
      } catch {
        return { error: 'Biometric login could not be enabled right now. Please try again.' };
      }
    },
    [pendingEnrollment]
  );

  const signOut = useCallback(async () => {
  setPendingEnrollment(null);
  logoutPushUser();
  await supabase.auth.signOut();
}, []);

const value: AuthContextType = {
  user,
  session,
  loading,
  onboardingComplete,
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
