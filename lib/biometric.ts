import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from './supabase';

const LEGACY_CREDENTIALS_KEY = 'dadhealth.biometric.credentials';
const SESSION_KEY = 'dadhealth.biometric.session.v2';

type StoredSession = { refreshToken: string };

export type BiometricResult = { success: boolean; error?: string; code?: string };

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function removeLegacyCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY).catch(() => {});
}

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

export async function getBiometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
  return 'Biometrics';
}

export async function hasBiometricCredentials(): Promise<boolean> {
  try {
    await removeLegacyCredentials();
    const raw = await SecureStore.getItemAsync(SESSION_KEY, secureStoreOptions);
    if (!raw) return false;
    const stored = JSON.parse(raw) as Partial<StoredSession>;
    return typeof stored.refreshToken === 'string' && stored.refreshToken.length > 0;
  } catch {
    return false;
  }
}

/** Persist only the revocable Supabase refresh token, never the user's password. */
export async function saveBiometricSession(refreshToken: string): Promise<void> {
  try {
    await removeLegacyCredentials();
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({ refreshToken } satisfies StoredSession),
      secureStoreOptions,
    );
  } catch {}
}

export async function clearBiometricCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}),
    removeLegacyCredentials(),
  ]);
}

export async function biometricLogin(): Promise<BiometricResult> {
  if (!(await isBiometricAvailable())) {
    return { success: false, error: 'Biometric login is not set up on this device.' };
  }

  await removeLegacyCredentials();
  const raw = await SecureStore.getItemAsync(SESSION_KEY, secureStoreOptions);
  if (!raw) {
    return { success: false, error: 'Sign in with your password once to enable biometric login.' };
  }

  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Log in to Dad Health',
    fallbackLabel: 'Use password',
    cancelLabel: 'Cancel',
  });

  if (!auth.success) {
    const code = auth.error as string | null;
    const error = code === 'user_cancel' || code === 'system_cancel' || code === 'app_cancel' || code === 'user_fallback'
      ? 'Authentication cancelled.'
      : code === 'lockout'
        ? 'Too many attempts. Please sign in with your password.'
        : 'Biometric authentication failed.';
    return { success: false, error, code: code ?? undefined };
  }

  let stored: StoredSession;
  try {
    stored = JSON.parse(raw) as StoredSession;
    if (typeof stored.refreshToken !== 'string' || !stored.refreshToken) throw new Error('invalid_session');
  } catch {
    await clearBiometricCredentials();
    return { success: false, error: 'Biometric sign-in needs to be enabled again.' };
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: stored.refreshToken });
  if (error || !data.session?.refresh_token) {
    await clearBiometricCredentials();
    return { success: false, error: 'Biometric sign-in is no longer available. Please sign in with your password.' };
  }

  await saveBiometricSession(data.session.refresh_token);
  return { success: true };
}
