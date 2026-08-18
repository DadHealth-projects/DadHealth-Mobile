import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from './supabase';

const LEGACY_CREDENTIALS_KEY = 'dadhealth.biometric.credentials';
const LEGACY_SESSION_KEY = 'dadhealth.biometric.session.v2';
const DEVICE_ID_KEY = 'dadhealth.biometric.device.v3.id';
const CREDENTIAL_KEY = 'dadhealth.biometric.device.v3.credential';
const ENABLED_KEY = 'dadhealth.biometric.device.v3.enabled';

const CONFIGURED_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk';
const WEB_URL = CONFIGURED_WEB_URL
  .replace(/^https:\/\/dadhealth\.co\.uk(?=\/|$)/, 'https://www.dadhealth.co.uk')
  .replace(/\/$/, '');

export type BiometricResult = { success: boolean; error?: string; code?: string };

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const biometricStoreOptions: SecureStore.SecureStoreOptions = {
  ...secureStoreOptions,
  requireAuthentication: true,
  authenticationPrompt: 'Log in to Dad Health',
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function removeLegacyCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY, secureStoreOptions),
    SecureStore.deleteItemAsync(LEGACY_SESSION_KEY, secureStoreOptions),
  ]);
}

async function clearCurrentDeviceCredential(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ENABLED_KEY, secureStoreOptions),
    SecureStore.deleteItemAsync(DEVICE_ID_KEY, secureStoreOptions),
    SecureStore.deleteItemAsync(CREDENTIAL_KEY, biometricStoreOptions),
  ]);
}

async function readDeviceId(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_ID_KEY, secureStoreOptions);
}

function mapLocalAuthenticationFailure(
  result: LocalAuthentication.LocalAuthenticationResult,
): BiometricResult {
  if (result.success) return { success: true };

  const code = result.error as string | null;
  const error = code === 'user_cancel' || code === 'system_cancel' || code === 'app_cancel' || code === 'user_fallback'
    ? 'Authentication cancelled.'
    : code === 'lockout'
      ? 'Too many attempts. Please sign in with your password.'
      : 'Face ID could not confirm your identity. Please try again.';
  return { success: false, error, code: code ?? undefined };
}

function isCancellationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('cancel') || message.includes('user interaction is not allowed');
}

function mapExchangeError(status: number, code?: string): BiometricResult {
  if (status === 429 || code === 'rate_limited') {
    return {
      success: false,
      error: 'Too many Face ID sign-in attempts. Wait 15 minutes and try again.',
      code: 'rate_limited',
    };
  }
  if (status === 401 || code === 'credential_invalid') {
    return {
      success: false,
      error: 'Face ID login is no longer active on this device. Sign in with your password to enable it again.',
      code: 'credential_invalid',
    };
  }
  return {
    success: false,
    error: 'Face ID sign-in is temporarily unavailable. Check your connection and try again.',
    code: code ?? 'exchange_unavailable',
  };
}

async function revokeServerDevice(accessToken: string, deviceId: string): Promise<Response> {
  return fetch(`${WEB_URL}/api/auth/biometric/device`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ deviceId }),
  });
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
    const [enabled, deviceId] = await Promise.all([
      SecureStore.getItemAsync(ENABLED_KEY, secureStoreOptions),
      readDeviceId(),
    ]);
    return enabled === 'true' && Boolean(deviceId);
  } catch {
    return false;
  }
}

export async function enrollBiometricCredential(accessToken: string): Promise<BiometricResult> {
  if (!(await isBiometricAvailable())) {
    return { success: false, error: 'Biometric login is not set up on this device.' };
  }

  const authentication = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Log in to Dad Health',
    fallbackLabel: 'Use password',
    cancelLabel: 'Cancel',
  });
  const authenticationResult = mapLocalAuthenticationFailure(authentication);
  if (!authenticationResult.success) return authenticationResult;

  const credential = bytesToHex(await Crypto.getRandomBytesAsync(32));
  let deviceId: string | null = null;

  try {
    const response = await fetch(`${WEB_URL}/api/auth/biometric/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ credential }),
    });
    const body = await response.json().catch(() => ({})) as { deviceId?: string; code?: string };

    if (!response.ok || typeof body.deviceId !== 'string') {
      if (response.status === 401) {
        return {
          success: false,
          error: 'Your sign-in session ended before Face ID could be enabled. Sign in again and retry.',
          code: body.code ?? 'auth_required',
        };
      }
      return {
        success: false,
        error: 'Face ID could not be enabled right now. Check your connection and try again.',
        code: body.code ?? 'enrollment_unavailable',
      };
    }

    deviceId = body.deviceId;
    await SecureStore.setItemAsync(CREDENTIAL_KEY, credential, biometricStoreOptions);
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, secureStoreOptions);
    await SecureStore.setItemAsync(ENABLED_KEY, 'true', secureStoreOptions);
    await removeLegacyCredentials();
    return { success: true };
  } catch {
    await clearCurrentDeviceCredential().catch(() => {});
    if (deviceId) await revokeServerDevice(accessToken, deviceId).catch(() => null);
    return {
      success: false,
      error: 'Face ID could not be saved securely on this device. Please try enabling it again.',
      code: 'secure_storage_failed',
    };
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  await clearCurrentDeviceCredential();
  await removeLegacyCredentials();
}

export async function disableBiometricLogin(accessToken: string): Promise<BiometricResult> {
  try {
    const deviceId = await readDeviceId();
    if (deviceId) {
      let response: Response;
      try {
        response = await revokeServerDevice(accessToken, deviceId);
      } catch {
        return {
          success: false,
          error: 'Face ID login could not be turned off. Check your connection and try again.',
        };
      }
      if (!response.ok) {
        return {
          success: false,
          error: response.status === 401
            ? 'Your session ended before Face ID login could be turned off. Sign in again and retry.'
            : 'Face ID login could not be turned off right now. Please try again.',
        };
      }
    }

    try {
      await clearBiometricCredentials();
    } catch {
      return {
        success: false,
        error: 'Face ID login was revoked, but its saved device credential could not be removed. Please try again.',
      };
    }
    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Face ID login could not be turned off right now. Please try again.',
    };
  }
}

async function performBiometricLogin(): Promise<BiometricResult> {
  if (!(await isBiometricAvailable())) {
    return { success: false, error: 'Biometric login is not set up on this device.' };
  }

  const deviceId = await readDeviceId();
  if (!deviceId) {
    return { success: false, error: 'Sign in with your password once to enable biometric login.' };
  }

  let credential: string | null;
  try {
    credential = await SecureStore.getItemAsync(CREDENTIAL_KEY, biometricStoreOptions);
  } catch (error) {
    if (isCancellationError(error)) {
      return { success: false, error: 'Authentication cancelled.', code: 'user_cancel' };
    }
    return {
      success: false,
      error: 'Face ID could not access your saved sign-in on this device. Sign in with your password to enable it again.',
      code: 'credential_unavailable',
    };
  }

  if (!credential) {
    await clearCurrentDeviceCredential().catch(() => {});
    return {
      success: false,
      error: 'Face ID login needs to be enabled again. Sign in with your password to continue.',
      code: 'credential_unavailable',
    };
  }

  let response: Response;
  try {
    response = await fetch(`${WEB_URL}/api/auth/biometric/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, credential }),
    });
  } catch {
    return mapExchangeError(0, 'network_unavailable');
  }

  const body = await response.json().catch(() => ({})) as { tokenHash?: string; code?: string };
  if (!response.ok || typeof body.tokenHash !== 'string') {
    const result = mapExchangeError(response.status, body.code);
    if (result.code === 'credential_invalid') {
      await clearCurrentDeviceCredential().catch(() => {});
    }
    return result;
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: body.tokenHash,
    type: 'magiclink',
  });
  if (error || !data.session) {
    return {
      success: false,
      error: 'The secure Face ID sign-in code expired. Try Face ID again.',
      code: 'token_exchange_failed',
    };
  }

  return { success: true };
}

export async function biometricLogin(): Promise<BiometricResult> {
  try {
    return await performBiometricLogin();
  } catch {
    return {
      success: false,
      error: 'Biometric sign-in could not be completed on this device. Please try again or use your password.',
      code: 'biometric_unavailable',
    };
  }
}
