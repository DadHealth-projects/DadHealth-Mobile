import { setAudioModeAsync } from 'expo-audio';

// Exclusive mode ownership: delayed recorder cleanup cannot reset a Reset session.
let owner: symbol | null = null;
let kindOwned: 'reset' | 'recording' | null = null;
export const getAudioOwner = () => kindOwned;
export async function acquireAudio(kind: 'reset' | 'recording'): Promise<() => Promise<void>> {
  if (owner) throw new Error('Audio is already in use');
  const token = Symbol(kind);
  owner = token; kindOwned = kind;
  try {
    await setAudioModeAsync({
      allowsRecording: kind === 'recording', allowsBackgroundRecording: false,
      playsInSilentMode: true, interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: kind === 'reset',
    });
  } catch (error) { if (owner === token) { owner = null; kindOwned = null; } throw error; }
  return async () => {
    if (owner !== token) return;
    try {
      // Only the recording owner disables recording. Reset does not reset global mode.
      if (kind === 'recording') await setAudioModeAsync({ allowsRecording: false });
    } finally { if (owner === token) { owner = null; kindOwned = null; } }
  };
}
