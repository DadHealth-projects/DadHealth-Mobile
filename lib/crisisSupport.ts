import { Alert, Linking } from 'react-native';

import { FOOTER } from './homeContent';

export function crisisSupportPhoneDisplay() {
  return FOOTER.crisis.label.match(/[\d\s]+$/)?.[0].trim() ?? FOOTER.crisis.tel;
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
