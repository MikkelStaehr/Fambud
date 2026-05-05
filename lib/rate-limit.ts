// Tynd wrapper rundt om public.rate_limit_check RPC. Returnerer true
// hvis kaldet skal slippe igennem, false hvis loftet er nået.
//
// Vi bruger IP fra x-forwarded-for som key for unauthenticated flows
// (signup, reset password). For authenticated flows (feedback) bruger
// vi user.id direkte - mere robust mod IP-ændringer og NAT-deling.
//
// Tabellen lever bag SECURITY DEFINER - en authenticated bruger kan
// ikke skrive direkte til den, kun via funktionen.

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type RateLimitConfig = {
  /** Hvor mange hits er tilladt inden for vinduet */
  maxHits: number;
  /** Vindue i sekunder */
  windowSeconds: number;
};

// Standardlofter pr. route. SOURCE OF TRUTH er nu i public.rate_limit_routes
// (migration 0048) - klient-leverede max_hits/window ignoreres af RPC'en.
// Vi beholder objektet her for at signature-validate route names og
// dokumentere lofter.
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  signup: { maxHits: 5, windowSeconds: 3600 },
  reset_password: { maxHits: 5, windowSeconds: 3600 },
  feedback: { maxHits: 10, windowSeconds: 3600 },
  feedback_household: { maxHits: 30, windowSeconds: 3600 },
  login: { maxHits: 10, windowSeconds: 900 },
};

// Henter klient-IP fra request-headers. På Vercel er den korrekte IP
// den HØJREMOST værdi i x-forwarded-for - Vercel appender klient-IP'en
// til chain'en, så den første værdi i listen er attacker-controlled
// (klienten kan sende vilkårlig X-Forwarded-For som først hop).
//
// Vercel eksponerer også x-vercel-forwarded-for som ikke kan spoofes.
// Vi prøver det først.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const vercelIp = h.get('x-vercel-forwarded-for');
  if (vercelIp) return vercelIp.split(',')[0]!.trim();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    // Tag rightmost (Vercel's appended value), ikke leftmost (kan spoofes)
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return h.get('x-real-ip') ?? 'unknown';
}

export async function checkRateLimit(
  key: string,
  route: keyof typeof RATE_LIMITS
): Promise<boolean> {
  const config = RATE_LIMITS[route];
  if (!config) {
    throw new Error(`Unknown rate-limit route: ${route}`);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('rate_limit_check', {
    p_key: key,
    p_route: route,
    p_max_hits: config.maxHits,
    p_window_seconds: config.windowSeconds,
  });

  if (error) {
    // Fail-open: hvis rate-limit-tjekket selv fejler vil vi hellere
    // tillade requesten end at låse legitime brugere ude. Logges
    // til Vercel så vi kan se det.
    console.error('rate_limit_check failed:', error);
    return true;
  }
  return data === true;
}
