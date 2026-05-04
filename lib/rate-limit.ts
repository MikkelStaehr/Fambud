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

// Standardlofter pr. route. Stramme nok til at blokere automatiseret
// abuse, slappe nok til at en menneskelig bruger der laver fejl ikke
// rammer dem.
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  signup: { maxHits: 5, windowSeconds: 3600 }, // 5/time pr. IP
  reset_password: { maxHits: 5, windowSeconds: 3600 }, // 5/time pr. IP+email
  feedback: { maxHits: 10, windowSeconds: 3600 }, // 10/time pr. user
};

// Henter klient-IP fra x-forwarded-for. Vercel sætter den korrekt;
// hvis den mangler, falder vi tilbage til 'unknown' (deler én bucket
// for alle der mangler header - det rammer dårlig hvis flere reelle
// brugere ikke har header, men sker ikke i Vercel-prod).
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
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
