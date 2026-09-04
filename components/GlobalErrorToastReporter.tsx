import InlineFormError from './InlineFormError';
import { useNetworkStatus } from '../contexts/NetworkContext';

export default function GlobalErrorToastReporter({ message }: { message?: string | null }) {
  const { isOffline } = useNetworkStatus();

  return <InlineFormError message={isOffline ? null : message} />;
}
