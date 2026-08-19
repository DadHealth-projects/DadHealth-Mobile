import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Supabase session storage backed by expo-secure-store on native devices and
 * localStorage in the Expo web runtime, where SecureStore is unavailable.
 *
 * SecureStore rejects values larger than ~2048 bytes, and a Supabase session
 * (JWT access token + refresh token + user) routinely exceeds that. So values
 * are split into <2000-byte chunks stored under `${key}.0`, `${key}.1`, … with
 * the chunk count kept at `${key}.__count`.
 *
 * Hardening: every SecureStore call is wrapped in try/catch and NEVER throws — a
 * Supabase storage adapter that throws will break sign-in / sign-out (this is the
 * cause of the "logout stuck on spinner" bug). Failures are handled silently so
 * internal storage details never appear in the client console.
 */
const CHUNK_SIZE = 2000;
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const countKey = (key: string) => `${key}.__count`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

// expo-secure-store has no browser implementation. Supabase reads its session
// back through this adapter before each authenticated REST request, so silently
// discarding web writes makes those requests fall back to the anon API key.
// Use the browser's standard persistent storage for Expo web while retaining
// hardware-backed SecureStore on iOS and Android.
const webMemoryFallback = new Map<string, string>();

function getWebStorage(): Storage | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  return globalThis.localStorage;
}

function getWebItem(key: string): string | null {
  try {
    return getWebStorage()?.getItem(key) ?? webMemoryFallback.get(key) ?? null;
  } catch {
    return webMemoryFallback.get(key) ?? null;
  }
}

function setWebItem(key: string, value: string): void {
  // Keep an in-memory copy so the current authenticated session still works if
  // browser storage is unavailable or blocked for this origin.
  webMemoryFallback.set(key, value);
  try {
    getWebStorage()?.setItem(key, value);
  } catch {
    // The in-memory fallback above remains available for this page lifecycle.
  }
}

function removeWebItem(key: string): void {
  webMemoryFallback.delete(key);
  try {
    getWebStorage()?.removeItem(key);
  } catch {
    // The in-memory value has still been removed.
  }
}

async function getChunkCount(key: string): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(countKey(key), secureStoreOptions);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function removeAllChunks(key: string): Promise<void> {
  const count = await getChunkCount(key);
  const keys = [countKey(key)];
  for (let i = 0; i < count; i++) keys.push(chunkKey(key, i));
  await Promise.all(
    keys.map(async (k) => {
      try {
        await SecureStore.deleteItemAsync(k);
      } catch {
      }
    })
  );
}

export const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return getWebItem(key);

    try {
      const count = await getChunkCount(key);
      if (count === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i), secureStoreOptions);
        // A missing chunk means corrupted/partial state — treat as no value.
        if (part == null) {
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      setWebItem(key, value);
      return;
    }

    try {
      // Clear any previous (possibly longer) value first to avoid orphan chunks.
      await removeAllChunks(key);

      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      await Promise.all(
        chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk, secureStoreOptions))
      );
      await SecureStore.setItemAsync(countKey(key), String(chunks.length), secureStoreOptions);
    } catch {
      // Swallow: a storage adapter must not throw or it breaks Supabase auth.
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      removeWebItem(key);
      return;
    }

    try {
      await removeAllChunks(key);
    } catch {
    }
  },
};
