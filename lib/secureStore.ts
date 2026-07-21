import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage backed entirely by expo-secure-store (hardware-backed
 * keychain / keystore) — no localStorage / AsyncStorage.
 *
 * SecureStore rejects values larger than ~2048 bytes, and a Supabase session
 * (JWT access token + refresh token + user) routinely exceeds that. So values
 * are split into <2000-byte chunks stored under `${key}.0`, `${key}.1`, … with
 * the chunk count kept at `${key}.__count`.
 *
 * Hardening: every SecureStore call is wrapped in try/catch and NEVER throws — a
 * Supabase storage adapter that throws will break sign-in / sign-out (this is the
 * cause of the "logout stuck on spinner" bug). Failures are logged structurally,
 * and stored VALUES (tokens) are never logged — only the non-secret key name.
 */
const TAG = '[secureStore]';
const CHUNK_SIZE = 2000;

const countKey = (key: string) => `${key}.__count`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

function logWarn(op: string, error: unknown, extra: Record<string, unknown> = {}): void {
  console.warn(
    TAG,
    JSON.stringify({
      op,
      message: error instanceof Error ? error.message : String(error),
      ...extra,
    })
  );
}

async function getChunkCount(key: string): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(countKey(key));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (error) {
    logWarn('getChunkCount', error, { key });
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
      } catch (error) {
        logWarn('deleteItem', error, { key });
      }
    })
  );
}

export const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const count = await getChunkCount(key);
      if (count === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i));
        // A missing chunk means corrupted/partial state — treat as no value.
        if (part == null) {
          logWarn('getItem.missingChunk', new Error('missing chunk'), { key, index: i });
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    } catch (error) {
      logWarn('getItem', error, { key });
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Clear any previous (possibly longer) value first to avoid orphan chunks.
      await removeAllChunks(key);

      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      await Promise.all(
        chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk))
      );
      await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    } catch (error) {
      // Swallow: a storage adapter must not throw or it breaks Supabase auth.
      logWarn('setItem', error, { key });
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await removeAllChunks(key);
    } catch (error) {
      logWarn('removeItem', error, { key });
    }
  },
};
