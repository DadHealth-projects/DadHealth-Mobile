import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';
import {
  getStateFromPath,
  type LinkingOptions,
} from '@react-navigation/native';

import type { AppStackParamList } from '../navigation/AppNavigator';

const PENDING_CO_PARENT_INVITE_KEY = 'dadhealth.deep-link.co-parent-invite.v1';
const MAX_INVITE_TOKEN_LENGTH = 4096;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INVALID_CO_PARENT_INVITE = '__invalid_co_parent_invite__';
export const INVALID_CO_PARENT_INVITE_MESSAGE =
  'This calendar invite is invalid or has expired. Ask your co-parent to send a new invite.';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type PendingCoParentInvite = {
  token: string;
  blockedUserId?: string;
};

const routeConfig = {
  screens: {
    SharedCalendar: 'shared-calendar',
    CommunityPostThread: 'community/:postId',
  },
};

function normalizedPath(path: string): string {
  return path
    .replace(/^dadhealth:\/\//i, '')
    .replace(/^\/+/, '');
}

function queryValue(path: string, name: string): string | null {
  const queryIndex = path.indexOf('?');
  if (queryIndex < 0) return null;
  try {
    return new URLSearchParams(path.slice(queryIndex + 1)).get(name);
  } catch {
    return null;
  }
}

function supportedDeepLinkPath(rawUrl: string): boolean {
  const path = normalizedPath(rawUrl);
  const pathname = path.split('?', 1)[0]?.replace(/\/+$/, '') ?? '';
  if (pathname === 'shared-calendar') return true;

  const communityMatch = pathname.match(/^community\/([^/]+)$/);
  if (!communityMatch) return false;
  try {
    return isValidCommunityPostId(decodeURIComponent(communityMatch[1]));
  } catch {
    return false;
  }
}

async function capturePendingInviteFromUrl(rawUrl: string): Promise<void> {
  const path = normalizedPath(rawUrl);
  const pathname = path.split('?', 1)[0]?.replace(/\/+$/, '') ?? '';
  if (pathname !== 'shared-calendar') return;
  const token = queryValue(path, 'token');
  if (isValidCoParentInviteToken(token)) {
    await persistPendingCoParentInvite(token);
  }
}

export function isValidCoParentInviteToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_INVITE_TOKEN_LENGTH
    && value === value.trim()
    && JWT_PATTERN.test(value);
}

export function isValidCommunityPostId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function safeStateFromPath(
  rawPath: string,
  options?: Parameters<typeof getStateFromPath>[1],
) {
  const path = normalizedPath(rawPath);
  const pathname = path.split('?', 1)[0]?.replace(/\/+$/, '') ?? '';

  if (pathname === 'auth/callback') {
    // Reserved for the in-app Google OAuth browser exchange.
    return undefined;
  }

  if (pathname === 'shared-calendar') {
    const token = queryValue(path, 'token');
    const safeToken = isValidCoParentInviteToken(token)
      ? token
      : INVALID_CO_PARENT_INVITE;
    return getStateFromPath(
      `shared-calendar?token=${encodeURIComponent(safeToken)}`,
      options,
    );
  }

  const communityMatch = pathname.match(/^community\/([^/]+)$/);
  if (communityMatch) {
    let postId = '';
    try {
      postId = decodeURIComponent(communityMatch[1]);
    } catch {
      return undefined;
    }
    if (!isValidCommunityPostId(postId)) return undefined;
    return getStateFromPath(`community/${postId}`, options);
  }

  // Unsupported dadhealth:// paths are intentionally ignored.
  return undefined;
}

export const deepLinkingOptions: LinkingOptions<AppStackParamList> = {
  prefixes: ['dadhealth://'],
  config: routeConfig,
  getStateFromPath: safeStateFromPath,
  getInitialURL: async () => {
    const url = await Linking.getInitialURL();
    if (!url || !supportedDeepLinkPath(url)) return null;
    await capturePendingInviteFromUrl(url).catch(() => undefined);
    return url;
  },
  subscribe: (listener) => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!supportedDeepLinkPath(url)) return;
      void capturePendingInviteFromUrl(url)
        .catch(() => undefined)
        .finally(() => listener(url));
    });
    return () => subscription.remove();
  },
};

export async function readPendingCoParentInvite(): Promise<PendingCoParentInvite | null> {
  const raw = await SecureStore.getItemAsync(PENDING_CO_PARENT_INVITE_KEY, secureStoreOptions);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingCoParentInvite>;
    if (!isValidCoParentInviteToken(parsed.token)) {
      await SecureStore.deleteItemAsync(PENDING_CO_PARENT_INVITE_KEY, secureStoreOptions);
      return null;
    }
    return {
      token: parsed.token,
      blockedUserId: typeof parsed.blockedUserId === 'string'
        ? parsed.blockedUserId
        : undefined,
    };
  } catch {
    await SecureStore.deleteItemAsync(PENDING_CO_PARENT_INVITE_KEY, secureStoreOptions);
    return null;
  }
}

export async function persistPendingCoParentInvite(token: string): Promise<void> {
  if (!isValidCoParentInviteToken(token)) throw new Error('invalid_invite');
  const current = await readPendingCoParentInvite();
  const next: PendingCoParentInvite = current?.token === token
    ? current
    : { token };
  await SecureStore.setItemAsync(
    PENDING_CO_PARENT_INVITE_KEY,
    JSON.stringify(next),
    secureStoreOptions,
  );
}

export async function blockPendingCoParentInviteForUser(
  token: string,
  userId: string,
): Promise<void> {
  if (!isValidCoParentInviteToken(token)) return;
  await SecureStore.setItemAsync(
    PENDING_CO_PARENT_INVITE_KEY,
    JSON.stringify({ token, blockedUserId: userId } satisfies PendingCoParentInvite),
    secureStoreOptions,
  );
}

export async function clearPendingCoParentInvite(expectedToken?: string): Promise<void> {
  if (expectedToken) {
    const current = await readPendingCoParentInvite();
    if (current && current.token !== expectedToken) return;
  }
  await SecureStore.deleteItemAsync(PENDING_CO_PARENT_INVITE_KEY, secureStoreOptions);
}

const inviteAttempts = new Set<string>();
const handledInvites = new Set<string>();

export function beginCoParentInviteAttempt(token: string): boolean {
  if (inviteAttempts.has(token) || handledInvites.has(token)) return false;
  inviteAttempts.add(token);
  return true;
}

export function finishCoParentInviteAttempt(token: string, handled: boolean): void {
  inviteAttempts.delete(token);
  if (handled) handledInvites.add(token);
}

export function wasCoParentInviteHandled(token: string): boolean {
  return handledInvites.has(token);
}
