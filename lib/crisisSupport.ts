import { Linking, Platform } from 'react-native';

// Official service details checked 2026-11-19; sources recorded in the Batch 1 task.
export const crisisServices = [
  { id: 'emergency', name: 'Emergency help', detail: 'UK · 24 hours. If someone’s life is in immediate danger, call 999.', action: 'Call 999', phone: '999' },
  { id: 'samaritans', name: 'Samaritans', detail: 'UK and Ireland · Free, 24 hours every day. Someone to listen when you need support.', action: 'Call 116 123', phone: '116123' },
  { id: 'shout', name: 'Shout', detail: 'UK · 24 hours every day. Text SHOUT to 85258. Free on supported networks; some networks cannot send short codes or may charge. You may need to wait for a reply.', action: 'Text 85258', phone: '85258' },
  { id: 'calm', name: 'CALM', detail: 'UK · For people over 18. Free, 5pm–midnight UK time every day. Support with suicide or suicidal thoughts, including concerns about someone else.', action: 'Call 0800 58 58 58', phone: '0800585858' },
] as const;
export type CrisisAction = typeof crisisServices[number]['id'] | 'local';
export const localSupportUrl = 'https://findahelpline.com/';
export const outsideUKCopy = 'These are UK services; Samaritans also serves Ireland. UK numbers and text short codes may not work abroad. In immediate danger, contact emergency services where you are. Choose your country in Find A Helpline for local support.';

export function crisisActionUrl(action: CrisisAction, platform = Platform.OS): string {
  if (action === 'local') return localSupportUrl;
  const service = crisisServices.find(item => item.id === action);
  if (!service) throw new Error('Unknown support action');
  // Recipient only: the user types SHOUT and chooses whether to send.
  // iOS documents sms:<number>; Android supports smsto:<number>.
  return action === 'shout'
    ? `${platform === 'android' ? 'smsto' : 'sms'}:${service.phone}`
    : `tel:${service.phone}`;
}

/** Resolving means the native app opened, never that a call/message completed. */
export async function openCrisisSupport(action: CrisisAction): Promise<string | null> {
  try {
    await Linking.openURL(crisisActionUrl(action));
    return null;
  } catch {
    if (action === 'local') return 'Couldn’t open the directory. Visit findahelpline.com in your browser.';
    if (action === 'shout') return 'Couldn’t open Messages. Text SHOUT to 85258 manually.';
    const service = crisisServices.find(item => item.id === action);
    return `Couldn’t open the phone app. Dial ${service?.action.replace('Call ', '')} manually.`;
  }
}
