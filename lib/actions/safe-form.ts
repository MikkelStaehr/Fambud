// Helpere til at parse FormData sikkert i server actions.
//
// Mønster vi bruger overalt:
//   const name = String(formData.get('name') ?? '').trim();
// Det har to problemer:
//   1. Ingen length-cap → bruger kan submitte 50 MB strings og bloate DB
//   2. Hvis Postgres kaster en constraint-violation, sender mange actions
//      raw error.message ind i URL'en, hvilket lækker schema-detaljer
//
// Disse helpere giver et ensartet API der løser begge.

import { capLength, TEXT_LIMITS } from '@/lib/format';

/**
 * Læser et tekst-felt fra FormData, trimmer, cap'per længden.
 * Returnerer tom streng hvis feltet mangler.
 */
export function readText(
  formData: FormData,
  key: string,
  maxLength: number = TEXT_LIMITS.shortName
): string {
  return capLength(String(formData.get(key) ?? '').trim(), maxLength);
}

/**
 * Som readText, men returnerer null hvis feltet er tomt - til
 * optional-felter der skal skrives som NULL i DB.
 */
export function readOptionalText(
  formData: FormData,
  key: string,
  maxLength: number = TEXT_LIMITS.shortName
): string | null {
  const value = readText(formData, key, maxLength);
  return value || null;
}

/**
 * Maskerer en Postgres-fejl til en generisk dansk besked, og logger
 * den specifikke detalje server-side så vi kan debugge uden at lække
 * schema-info i URL'en.
 *
 * Brug:
 *   if (error) {
 *     redirect(redirectWithGenericError('/poster', error, 'Posten kunne ikke gemmes'));
 *   }
 */
export function redirectWithGenericError(
  path: string,
  error: { message?: string } | null | undefined,
  fallback: string
): string {
  if (error?.message) {
    console.error(`Action error at ${path}:`, error.message);
  }
  // Map et par hyppige constraint-violations til mere brugbare beskeder
  const message = error?.message ?? '';
  let msg = fallback;
  if (message.includes('does not belong to this household')) {
    msg = 'Operationen var ikke gyldig for jeres husstand';
  } else if (message.includes('check_violation')) {
    msg = 'Ugyldig værdi - tjek felterne og prøv igen';
  } else if (message.includes('not-null')) {
    msg = 'Et påkrævet felt manglede';
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}error=${encodeURIComponent(msg)}`;
}
