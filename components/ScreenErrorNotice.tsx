import InlineFormError from './InlineFormError';
import { useNetworkStatus } from '../contexts/NetworkContext';

/**
 * Reports a feature or screen error so it renders in the screen, at the bottom.
 *
 * The top toast is reserved for connectivity: offline, back online, and actions
 * that need a connection. A failed load or a failed save is not a connectivity
 * event and must not appear up there.
 */
export default function ScreenErrorNotice({ message }: { message: string | null | undefined }) {
  const { isOffline } = useNetworkStatus();

  return <InlineFormError message={isOffline ? null : message} />;
}
