import { Alert, Linking } from 'react-native';

import { FOOTER } from './homeContent';

export function crisisSupportPhoneDisplay() {
  return FOOTER.crisis.label.match(/[\d\s]+$/)?.[0].trim() ?? FOOTER.crisis.tel;
}

/** Show resource details first; calling always requires a separate explicit choice. */
export function showCrisisSupportDetails() {
  Alert.alert(
    'Need urgent help?',
    `Call Samaritans free on ${crisisSupportPhoneDisplay()}.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Call Samaritans', onPress: () => void openCrisisSupport() },
    ],
  );
}

/** Opens the existing crisis contact and preserves the prior manual-dial fallback. */
export async function openCrisisSupport(): Promise<boolean> {
  try {
    await Linking.openURL(`tel:${FOOTER.crisis.tel}`);
    return true;
  } catch {
    Alert.alert(
      'Unable to start the call',
      `Please dial ${crisisSupportPhoneDisplay()} directly to reach Samaritans.`,
    );
    return false;
  }
}
