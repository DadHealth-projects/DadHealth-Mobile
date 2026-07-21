import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from './supabase';

/**
 * OAuth sign-in, using the SAME Supabase providers as the web app (google, apple).
 * The business logic is Supabase's; only the transport is native:
 *   - Google: `signInWithOAuth` → open the provider in an in-app browser
 *     (expo-web-browser) → capture the redirect back to the app's `dadhealth://`
 *     scheme → complete the session (PKCE code exchange or implicit tokens).
 *   - Apple: native `expo-apple-authentication` → exchange the identity token via
 *     `signInWithIdToken` (the recommended native path; no browser round-trip).
 *
 * IMPORTANT (setup / testing): these require a DEV BUILD, not Expo Go — the
 * `dadhealth://` redirect and Apple's native module aren't wired in Expo Go. They
 * also require external config: Supabase Google/Apple providers enabled, the
 * redirect URL allow-listed in Supabase, Google OAuth client IDs, and Apple's
 * Services ID / bundle id. Until then these resolve with a clear error rather
 * than crashing. See claude.md.
 */

// Finishes any pending in-app browser auth session (safe no-op otherwise).
WebBrowser.maybeCompleteAuthSession();

export type OAuthResult = { error: string | null };

const TAG = '[oauth]';

function logWarn(op: string, error: unknown): void {
  console.warn(
    TAG,
    JSON.stringify({ op, message: error instanceof Error ? error.message : String(error) })
  );
}

/** Turn the provider redirect URL back into a Supabase session. */
async function completeSessionFromUrl(url: string): Promise<OAuthResult> {
  // PKCE flow: the redirect carries `?code=...`.
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error: error?.message ?? null };
  }

  // Implicit flow: tokens arrive in the URL fragment (`#access_token=...`).
  const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error: error?.message ?? null };
  }

  return { error: 'Sign-in did not return a session. Please try again.' };
}

export async function signInWithGoogle(): Promise<OAuthResult> {
  try {
    const redirectTo = makeRedirectUri({ scheme: 'dadhealth', path: 'auth/callback' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Could not start Google sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      return await completeSessionFromUrl(result.url);
    }
    // User dismissed the browser — not an error, just no sign-in.
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { error: null };
    }
    return { error: 'Google sign-in did not complete.' };
  } catch (error) {
    logWarn('signInWithGoogle', error);
    return { error: 'Google sign-in failed. Please try again.' };
  }
}

/** True only where native Apple Sign In is offered (iOS 13+ with the module present). */
export async function isAppleAuthAvailable(): Promise<boolean> {
  try {
    if (Platform.OS !== 'ios') return false;
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<OAuthResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const token = credential.identityToken;
    if (!token) return { error: 'Apple did not return an identity token.' };

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token });
    return { error: error?.message ?? null };
  } catch (error) {
    // The user tapping "Cancel" on the native sheet is not a real error.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      return { error: null };
    }
    logWarn('signInWithApple', error);
    return { error: 'Apple sign-in failed. Please try again.' };
  }
}
