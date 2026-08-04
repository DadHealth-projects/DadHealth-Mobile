/**
 * Port of `dadHealth/src/lib/stripe/subscription.ts`.
 *
 * Mobile cannot call the web's `/api/stripe/subscription` route (it needs the
 * Stripe secret key and a Next server session), so it reads the
 * webhook-synced `user_profile.subscription_status` column and applies the same
 * rule the web route applies to that value.
 */
export function isProSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}
