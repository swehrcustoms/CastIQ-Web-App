import type { AccessTier } from './catalog';
import { currentAccessTier, type MembershipRecord } from './membership';

/**
 * Partner test accounts. The email decides the plan. Checkout does not.
 * ryan@castiqfishing.com keeps full Premium access.
 */
const PARTNER_TIERS: Record<string, AccessTier> = {
  'ryan@castiqfishing.com': 'premium',
  'ryan+free@castiqfishing.com': 'free',
  'ryan+standard@castiqfishing.com': 'standard',
  'ryan+premium@castiqfishing.com': 'premium',
};

function normalizedEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? '';
}

export function partnerTier(email: string | null | undefined): AccessTier | null {
  const tier = PARTNER_TIERS[normalizedEmail(email)];
  return tier ?? null;
}

export function hasFullAccess(email: string | null | undefined): boolean {
  return partnerTier(email) === 'premium';
}

export function planName(tier: AccessTier): 'Free' | 'Standard' | 'Premium' {
  if (tier === 'standard') return 'Standard';
  if (tier === 'premium') return 'Premium';
  return 'Free';
}

export function tierForViewer(
  email: string | null | undefined,
  membership: MembershipRecord | null = null,
  now = Date.now(),
): AccessTier {
  return partnerTier(email) ?? currentAccessTier(membership, now);
}
