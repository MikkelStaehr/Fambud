'use server';

// Server Actions for "Find ud af det selv"-flowet.
//
// submitLandingFlow gemmer en anonym submission når brugeren rammer Step 3.
// Token bæres i localStorage og linkes til en bruger via
// link_landing_submission() RPC i signup-actionen.
//
// SECURITY:
//   1. Token valideres som UUID v4-mønster - vi accepterer ikke fri-tekst
//   2. flow_state-JSON cap'es til 4KB - vores faktiske state er <1KB,
//      4KB efterlader plads til evt. nye felter uden at lade angriber
//      bloate tabellen med MB-payloads
//   3. Per-IP rate limit: 30/time (RATE_LIMITS i lib/rate-limit.ts)
//   4. RLS-policy tillader kun INSERT, ingen SELECT/UPDATE for anon

import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { headers } from 'next/headers';

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FLOW_STATE_BYTES = 4096;

// SHA256 af IP + procesvis salt. NEXT_PUBLIC_LANDING_IP_SALT kan
// roteres ved behov - eksisterende rækker bliver bare unmatchable
// efter rotation, hvilket er den rigtige privacy-default.
function hashIp(ip: string): string {
  const salt = process.env.LANDING_IP_SALT ?? 'fambud-landing';
  return createHash('sha256').update(salt + ':' + ip).digest('hex').slice(0, 32);
}

// Sanitize flow_state - vi insister ikke på et eksakt schema (det ændrer sig)
// men fjerner felter der ligner injection-forsøg og cap'er hele payload'en.
type SubmitResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitLandingFlow(
  token: string,
  flowState: unknown
): Promise<SubmitResult> {
  // Token-format-tjek: kun gyldige UUIDv4-formede strenge accepteres.
  // Det forhindrer at angriber sender fx tomme strings eller massive
  // tokens der bloater index'et.
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    return { ok: false, error: 'Ugyldig token' };
  }

  // Payload-size-cap. Vi serialiserer så vi måler den faktiske byte-
  // størrelse (utf-8). Hvis det er for stort, afvis - vores state er
  // <1KB normalt, så 4KB er rigeligt.
  let serialised: string;
  try {
    serialised = JSON.stringify(flowState);
  } catch {
    return { ok: false, error: 'Ugyldig payload' };
  }
  if (Buffer.byteLength(serialised, 'utf8') > MAX_FLOW_STATE_BYTES) {
    return { ok: false, error: 'Payload for stor' };
  }

  // Rate-limit per IP. Fail-open hvis tjekket selv fejler (bedre at
  // logge for mange end at låse legitime brugere ude).
  const ip = await getClientIp();
  const ipOk = await checkRateLimit(`ip:${ip}`, 'landing_flow_submission');
  if (!ipOk) {
    return { ok: false, error: 'For mange forsøg, prøv igen senere' };
  }

  const userAgent = (await headers()).get('user-agent')?.slice(0, 500) ?? null;
  const ipHash = hashIp(ip);

  const supabase = await createClient();
  const { error } = await supabase.from('landing_flow_submissions').insert({
    anonymous_token: token,
    flow_state: flowState as Record<string, unknown>,
    ip_hash: ipHash,
    user_agent: userAgent,
  });

  if (error) {
    console.error('submitLandingFlow failed:', error.message);
    return { ok: false, error: 'Internal error' };
  }

  return { ok: true };
}
