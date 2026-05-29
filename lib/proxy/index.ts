// Helpere til "setup proxy"-feature: delegeret opsætnings-adgang mellem
// partnere i samme husstand. Se migration 0065 for datamodel og motivation.
//
// Token-flow:
// 1. Mikkel anmoder om proxy til Louise → vi genererer en plain-text token
//    (base64url, 32 bytes random), gemmer SHA-256-hash i DB, sender plain
//    token i email til Louise
// 2. Louise klikker linket → /accept-proxy/[token] → vi hasher token og
//    matcher mod DB → viser samtykke-side
// 3. Hun klikker "Ja" → vi sætter accepted_at = now() og redirector
//
// Active session:
// Når Mikkel toggler "Skift til Louises perspektiv", sætter vi en
// HttpOnly cookie med grant_id. Server-side server-actions tjekker for
// denne cookie og hvis sat, skifter user_id-context til Louises.

import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Token generation + hashing
// ============================================================================

/**
 * Generér en kryptografisk sikker random token til proxy-accept-link.
 * Returnerer plain-text token (kun til email) og dens sha256-hash (til DB).
 *
 * Vi bruger 32 bytes = 256 bits entropy. Output er base64url-encoded så
 * det er URL-safe og ~43 tegn langt - kort nok til at passe i en email-link.
 */
export function generateProxyToken(): { plain: string; hash: string } {
  const buf = randomBytes(32);
  const plain = buf.toString('base64url');
  const hash = createHash('sha256').update(plain).digest('hex');
  return { plain, hash };
}

/** Hash en plain-text token til at slå op mod DB. */
export function hashProxyToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

// ============================================================================
// Active proxy session - cookie-baseret
// ============================================================================

const ACTIVE_PROXY_COOKIE = 'fambud_active_proxy';

/**
 * Sæt active proxy cookie. Mikkel sætter denne når han toggler "Skift til
 * Louises perspektiv" - så efterfølgende server actions skriver som Louise.
 *
 * Cookie indeholder grant_id'et som server kan validere mod DB ved hver
 * request. HttpOnly + secure i prod så client-side JS ikke kan læse den.
 */
export async function setActiveProxyCookie(grantId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROXY_COOKIE, grantId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Max 7 dage (matcher max grant-expiry); selve grant'en kan revokes
    // før det og så fail'er server-side tjek
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearActiveProxyCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_PROXY_COOKIE);
}

export type ActiveProxyContext = {
  grantId: string;
  grantorUserId: string;  // brugeren der GAV adgangen (Louise)
  granteeUserId: string;  // brugeren der MODTOG (Mikkel - aka caller)
  scope: string[];
  expiresAt: string;
  grantorName: string | null;
};

/**
 * Læs og validér active proxy-cookie. Returnerer null hvis ikke aktiv,
 * udløbet eller revoked.
 *
 * Denne funktion er DEN autoritative kilde til "er der en proxy aktiv?".
 * Server actions kalder den for at afgøre om de skal skrive som anden
 * bruger.
 */
export async function getActiveProxyContext(): Promise<ActiveProxyContext | null> {
  const cookieStore = await cookies();
  const grantId = cookieStore.get(ACTIVE_PROXY_COOKIE)?.value;
  if (!grantId) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Slå grant op + validér at den er aktiv og at caller er grantee
  const { data: grant } = await supabase
    .from('setup_proxy_grants')
    .select('id, household_id, grantor_user_id, grantee_user_id, scope, expires_at, accepted_at, revoked_at')
    .eq('id', grantId)
    .maybeSingle();

  if (!grant) return null;
  if (grant.grantee_user_id !== user.id) {
    // Cookie tilhører ikke nuværende bruger - clear den
    await clearActiveProxyCookie();
    return null;
  }
  if (grant.accepted_at == null) return null;
  if (grant.revoked_at != null) return null;
  if (new Date(grant.expires_at) <= new Date()) return null;

  // Hent grantor's navn til UI-banner
  const { data: grantorMember } = await supabase
    .from('family_members')
    .select('name')
    .eq('user_id', grant.grantor_user_id)
    .maybeSingle();

  return {
    grantId: grant.id,
    grantorUserId: grant.grantor_user_id,
    granteeUserId: grant.grantee_user_id,
    scope: grant.scope,
    expiresAt: grant.expires_at,
    grantorName: grantorMember?.name ?? null,
  };
}

// ============================================================================
// Effective user resolver - til server actions
// ============================================================================

/**
 * Returnér den user_id der skal skrives som (effective user) baseret på
 * proxy-state. Hvis proxy er aktiv og scope tillader operationen,
 * returneres grantor's user_id. Ellers returneres authenticated user's.
 *
 * Brug i server actions der opretter ressourcer:
 *
 *   const { effectiveUserId, authUser, isProxyActive, grantorName }
 *     = await resolveEffectiveUser('setup');
 *   await supabase.from('accounts').insert({
 *     created_by: effectiveUserId,
 *     owner_name: isProxyActive ? grantorName : ...,
 *     ...
 *   });
 */
export async function resolveEffectiveUser(scope: string = 'setup'): Promise<{
  authUserId: string | null;
  effectiveUserId: string | null;
  isProxyActive: boolean;
  grantorName: string | null;
  grantId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authUserId = user?.id ?? null;

  const ctx = await getActiveProxyContext();
  if (!ctx || !ctx.scope.includes(scope)) {
    return {
      authUserId,
      effectiveUserId: authUserId,
      isProxyActive: false,
      grantorName: null,
      grantId: null,
    };
  }

  return {
    authUserId,
    effectiveUserId: ctx.grantorUserId,
    isProxyActive: true,
    grantorName: ctx.grantorName,
    grantId: ctx.grantId,
  };
}

// ============================================================================
// Scope check
// ============================================================================

/**
 * Tjek om current proxy-context (hvis aktiv) tillader en given operation.
 * v1 har kun 'setup'-scope der dækker alle add-only opsætnings-handlinger.
 *
 * Hvis ingen proxy er aktiv, returneres null - caller bruger normal flow.
 * Hvis proxy er aktiv MEN ikke tillader operationen, returneres
 * { allowed: false, reason } så server action kan returnere en clean fejl.
 */
export type ScopeCheckResult =
  | { proxyActive: false }
  | { proxyActive: true; allowed: true; effectiveUserId: string; grantorName: string | null }
  | { proxyActive: true; allowed: false; reason: string };

export async function checkProxyScope(
  requiredScope: string = 'setup'
): Promise<ScopeCheckResult> {
  const ctx = await getActiveProxyContext();
  if (!ctx) return { proxyActive: false };

  if (!ctx.scope.includes(requiredScope)) {
    return {
      proxyActive: true,
      allowed: false,
      reason: `Din proxy-adgang dækker ikke "${requiredScope}". Skift tilbage til din egen profil i Indstillinger.`,
    };
  }

  return {
    proxyActive: true,
    allowed: true,
    effectiveUserId: ctx.grantorUserId,
    grantorName: ctx.grantorName,
  };
}
