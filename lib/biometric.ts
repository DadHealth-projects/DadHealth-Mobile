import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from './supabase';

// Small, single-blob credential store (well under SecureStore's 2 KB limit),
// separate from the chunked session store in secureStore.ts.
const CREDENTIALS_KEY = 'dadhealth.biometric.credentials';

type StoredCredentials = { email: string; password: string };

export type BiometricResult = { success: boolean; error?: string };

/** True when the device has biometric hardware AND the user has enrolled a face/finger. */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

/** Human label for the button, e.g. "Face ID", "Touch ID". */
export async function getBiometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Touch ID';
  }
  return 'Biometrics';
}

/** Whether we have credentials saved from a previous manual login. */
export async function hasBiometricCredentials(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    return raw != null;
  } catch (error) {
    console.warn(
      '[biometric]',
      JSON.stringify({
        op: 'read',
        message: error instanceof Error ? error.message : String(error),
      }),
    );

    return false;
  }
}

/**
 * Persist credentials after a successful manual sign-in so the user can unlock
 * with biometrics next time. Stored in the hardware keychain.
 */
export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  const payload: StoredCredentials = { email, password };
  try {
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify(payload),
  );
} catch (error) {
  console.warn(
    '[biometric]',
    JSON.stringify({
      op: 'save',
      message: error instanceof Error ? error.message : String(error),
    }),
  );
}
}

export async function clearBiometricCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}

/**
 * Prompt Face ID / Touch ID and, on success, sign in with the stored credentials.
 *
 * Note: this intentionally takes no email/password argument (unlike the Track B
 * sketch). At biometric-unlock time we don't have the password to hand — the
 * whole point is that the user doesn't retype it — so we read what was saved on
 * the previous manual login. If biometrics fail or nothing is stored, the caller
 * falls back to manual password entry.
 */
export async function biometricLogin(): Promise<BiometricResult> {
  if (!(await isBiometricAvailable())) {
    return { success: false, error: 'Biometric login is not set up on this device.' };
  }

  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!raw) {
    return {
      success: false,
      error: 'Sign in with your password once to enable biometric login.',
    };
  }

  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Log in to Dad Health',
    fallbackLabel: 'Use password',
    cancelLabel: 'Cancel',
  });

  if (!auth.success) {
    return { success: false, error: 'Biometric authentication failed.' };
  }

  let creds: StoredCredentials;
  try {
    creds = JSON.parse(raw) as StoredCredentials;
  } catch {
    await clearBiometricCredentials();
    return { success: false, error: 'Saved credentials were corrupted. Please sign in again.' };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });

  if (error) {
    // Password likely changed — drop the stale credentials.
    await clearBiometricCredentials();
    return { success: false, error: error.message };
  }
  return { success: true };
}
