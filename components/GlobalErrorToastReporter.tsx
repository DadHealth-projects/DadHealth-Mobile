import { useEffect } from 'react';

import { useNetworkStatus } from '../contexts/NetworkContext';

export default function GlobalErrorToastReporter({ message }: { message: string | null | undefined }) {
  const { showErrorNotice } = useNetworkStatus();

  useEffect(() => {
    if (message) showErrorNotice(message);
  }, [message, showErrorNotice]);

  return null;
}
