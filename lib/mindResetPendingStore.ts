import * as SecureStore from 'expo-secure-store';
import type { OfflineMindResetItem } from './offlineStorage';

const PAGE_SIZE = 8;

const key = (userId: string) =>
  `dadhealth.mindreset.pending.${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;

const pageKey = (userId: string, page: number) =>
  page === 0 ? key(userId) : `${key(userId)}.page.${page}`;

function valid(
  item: unknown,
  userId: string,
): item is OfflineMindResetItem {
  const value = item as OfflineMindResetItem | null;

  return Boolean(
    value &&
    value.kind === 'mind_reset_complete' &&
    value.userId === userId &&
    typeof value.id === 'string' &&
    value.payload &&
    typeof value.payload.completedAt === 'string' &&
    Number.isInteger(value.payload.activeSeconds),
  );
}

async function readPages(userId: string) {
  const pages: OfflineMindResetItem[][] = [];

  for (let page = 0; ; page++) {
    const raw = await SecureStore.getItemAsync(
      pageKey(userId, page),
    );

    if (raw === null) break;

    const parsed = JSON.parse(raw);

    if (
      !Array.isArray(parsed) ||
      !parsed.every(item => valid(item, userId))
    ) {
      throw new Error('Invalid pending completions');
    }

    pages.push(parsed);
  }

  return pages;
}

export async function readHeldMindResets(
  userId: string,
): Promise<OfflineMindResetItem[]> {
  try {
    const pages = await readPages(userId);
    const items = new Map<string, OfflineMindResetItem>();

    for (const page of pages) {
      for (const item of page) {
        items.set(item.id, item);
      }
    }

    return [...items.values()];
  } catch {
    throw new Error(
      'Pending Mind Reset storage is unavailable',
    );
  }
}

export async function writeHeldMindResets(
  userId: string,
  items: OfflineMindResetItem[],
): Promise<boolean> {
  try {
    if (!items.every(item => valid(item, userId))) {
      return false;
    }

    const pages = await readPages(userId);
    const wanted = new Map(items.map(item => [item.id, item]));

    const existingIds = new Set(
      pages.flat().map(item => item.id),
    );

    const additions = items.filter(
      item => !existingIds.has(item.id),
    );

    // Save new completions before removing old copies.
    for (let offset = 0; offset < additions.length; offset += PAGE_SIZE) {
      const batch = additions.slice(offset, offset + PAGE_SIZE);
      const page = pages.length;

      await SecureStore.setItemAsync(
        pageKey(userId, page),
        JSON.stringify(batch),
      );

      pages.push(batch);
    }

    // Keep page positions stable so interrupted writes
    // cannot hide completions stored on later pages.
    for (let page = 0; page < pages.length; page++) {
      const remaining = pages[page].filter(
        item => wanted.has(item.id),
      );

      if (remaining.length !== pages[page].length) {
        await SecureStore.setItemAsync(
          pageKey(userId, page),
          JSON.stringify(remaining),
        );

        pages[page] = remaining;
      }
    }

    // Remove empty trailing pages only.
    for (let page = pages.length - 1; page >= 0; page--) {
      if (pages[page].length > 0) break;

      await SecureStore.deleteItemAsync(
        pageKey(userId, page),
      );
    }

    return true;
  } catch {
    return false;
  }
}

export async function clearHeldMindResets(
  userId: string,
): Promise<void> {
  const keys: string[] = [];

  for (let page = 0; ; page++) {
    const storageKey = pageKey(userId, page);
    const raw = await SecureStore.getItemAsync(storageKey);

    if (raw === null) break;

    keys.push(storageKey);
  }

  // Delete backwards so interrupted cleanup leaves
  // remaining entries discoverable.
  for (const storageKey of keys.reverse()) {
    await SecureStore.deleteItemAsync(storageKey);
  }
}