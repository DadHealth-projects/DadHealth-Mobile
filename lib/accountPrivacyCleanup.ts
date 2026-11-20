import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { pauseAndClearOfflineUser } from './offlineSync';
import { clearOwnerBiometricCredentials } from './biometric';

// Only owner-qualified keys are removed here. Global biometric/session/audio
// owners must be cleared through their own lifecycle, never guessed key scans.
export async function clearPrivacyOwnerData(owner: string) {
  await serializeOwnerStorage(async () => {
    await SecureStore.setItemAsync(retiredKey(owner), '1');
    const keys: string[] = JSON.parse(await AsyncStorage.getItem(registryKey(owner)) ?? '[]');
    for (const key of new Set([...keys, `dadHealth_workout_timer.${owner}`, `dadHealth.dadDaysRadius.${owner}`, `dadhealth.deep-link.co-parent-invite.v2.${owner}`]))
      await SecureStore.deleteItemAsync(key);
  });
  await pauseAndClearOfflineUser(owner);
  await clearOwnerBiometricCredentials(owner);
  const keys = await AsyncStorage.getAllKeys();
  const owned = keys.filter(key => key.split(/[.:/]/).includes(owner));
  if (owned.length) await AsyncStorage.multiRemove(owned);
  await SecureStore.deleteItemAsync(`dadhealth_push_pre_permission_v1.${owner}`);
  await SecureStore.deleteItemAsync(`dadhealth.privacy.${owner}.export`);
  // The deletion receipt deliberately survives for narrow post-Auth status.
}

// Serialized owner-bound persistence: deletion waits for already-started writes,
// then marks the owner retired durably so delayed writes/restarts cannot restore it.
let ownerStorageQueue: Promise<unknown> = Promise.resolve();
function serializeOwnerStorage<T>(work: () => Promise<T>): Promise<T> {
  const result = ownerStorageQueue.catch(() => undefined).then(work);
  ownerStorageQueue = result;
  return result;
}
const retiredKey = (owner: string) => `dadhealth.privacy.retired.${owner}`;
const registryKey = (owner: string) => `dadhealth.privacy.secure-keys.${owner}`;
async function registerOwnerKey(owner: string, key: string) {
  const keys: string[] = JSON.parse(await AsyncStorage.getItem(registryKey(owner)) ?? '[]');
  if (!keys.includes(key)) await AsyncStorage.setItem(registryKey(owner), JSON.stringify([...keys, key]));
}
export function readOwnerSecret(owner: string, key: string, isCurrent = () => true) {
  return serializeOwnerStorage(async () => {
    if (!isCurrent() || await SecureStore.getItemAsync(retiredKey(owner))) return null;
    await registerOwnerKey(owner, key);
    const value = await SecureStore.getItemAsync(key);
    return isCurrent() ? value : null;
  });
}
export function writeOwnerSecret(owner: string, key: string, value: string, isCurrent = () => true) {
  return serializeOwnerStorage(async () => {
    if (!isCurrent() || await SecureStore.getItemAsync(retiredKey(owner))) return;
    await registerOwnerKey(owner, key);
    if (isCurrent()) await SecureStore.setItemAsync(key, value);
  });
}
