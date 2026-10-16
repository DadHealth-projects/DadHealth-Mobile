import type { ProMomentId } from './proMoments';

export type UpgradeMomentRequest = {
  id: ProMomentId;
  screen: string;
  isPro: boolean | null;
  trialActive: boolean | null;
  loading: boolean;
  featureAccess: boolean | null;
  hasCompletedAction: boolean;
};

export declare function createUpgradeMomentSession(): {
  request(request: UpgradeMomentRequest): boolean;
  dismiss(screen: string): boolean;
  isShown(id: ProMomentId): boolean;
  getActiveScreen(): string | null;
};
