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

const APPLE_CANCELLED_ERROR = 'Apple Sign In was cancelled.';
const APPLE_CONNECTION_ERROR =
  "We couldn't complete Apple Sign In because of a connection problem. Check your connection and try again.";
const APPLE_SESSION_ERROR =
  "Apple Sign In succeeded, but we couldn't finish signing you in. Please try again.";
const APPLE_UNKNOWN_ERROR = "We couldn't complete Apple Sign In. Please try again.";

type SessionMarker = {
  lastSignInAt: string | null;
  userId: string;
};

type SessionRecoveryResult = 'valid' | 'incomplete' | 'connection' | 'none';

function errorField(error: unknown, field: 'code' | 'message' | 'name'): string {
  if (!error || typeof error !== 'object' || !(field in error)) return '';
  const value = error[field as keyof typeof error];
  return typeof value === 'string' ? value : '';
}

function isAppleCancellation(error: unknown): boolean {
  return errorField(error, 'code') === 'ERR_REQUEST_CANCELED';
}

function isConnectionIssue(error: unknown): boolean {
  const details = [
    errorField(error, 'code'),
    errorField(error, 'name'),
    errorField(error, 'message'),
  ]
    .join(' ')
    .toLowerCase();

  return /(?:network request failed|failed to fetch|network error|connection|offline|timed?\s*out|econnreset|enotfound|authretryablefetcherror)/.test(
    details,
  );
}

function sessionMarker(session: {
  user?: { id?: string; last_sign_in_at?: string };
} | null): SessionMarker | null {
  if (!session?.user?.id) return null;
  return {
    lastSignInAt: session.user.last_sign_in_at ?? null,
    userId: session.user.id,
  };
}

async function readSessionMarker(): Promise<SessionMarker | null | undefined> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return undefined;
    return sessionMarker(data.session);
  } catch {
    // An unavailable baseline must never make an older session look newly created.
    return undefined;
  }
}

async function recoverNewAppleSession(
  previousSession: SessionMarker | null | undefined,
): Promise<SessionRecoveryResult> {
  if (previousSession === undefined) return 'none';

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return isConnectionIssue(sessionError) ? 'connection' : 'incomplete';
    }

    const currentSession = sessionMarker(sessionData.session);
    if (!currentSession) return 'none';

    const isNewSession =
      previousSession === null ||
      currentSession.userId !== previousSession.userId ||
      (currentSession.lastSignInAt !== null &&
        currentSession.lastSignInAt !== previousSession.lastSignInAt);
    if (!isNewSession) return 'none';

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return isConnectionIssue(userError) ? 'connection' : 'incomplete';
    }

    return userData.user?.id === currentSession.userId ? 'valid' : 'incomplete';
  } catch (error) {
    return isConnectionIssue(error) ? 'connection' : 'incomplete';
  }
}

/** Turn the provider redirect URL back into a Supabase session. */
async function completeSessionFromUrl(url: string): Promise<OAuthResult> {
  // PKCE flow: the redirect carries `?code=...`.
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error: error ? 'We could not complete sign-in. Please try again.' : null };
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
    if (error) return { error: 'Google sign-in could not be started. Please try again.' };
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
  } catch {
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
    if (!token) return { error: APPLE_SESSION_ERROR };

    const previousSession = await readSessionMarker();

    try {
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token });

      if (error) {
        return { error: isConnectionIssue(error) ? APPLE_CONNECTION_ERROR : APPLE_UNKNOWN_ERROR };
      }

      return { error: data.session ? null : APPLE_SESSION_ERROR };
    } catch (error) {
      const recovery = await recoverNewAppleSession(previousSession);
      if (recovery === 'valid') return { error: null };
      if (recovery === 'connection' || isConnectionIssue(error)) {
        return { error: APPLE_CONNECTION_ERROR };
      }
      if (recovery === 'incomplete') return { error: APPLE_SESSION_ERROR };

      return { error: APPLE_UNKNOWN_ERROR };
    }
  } catch (error) {
    if (isAppleCancellation(error)) return { error: APPLE_CANCELLED_ERROR };
    return { error: isConnectionIssue(error) ? APPLE_CONNECTION_ERROR : APPLE_UNKNOWN_ERROR };
  }
}
