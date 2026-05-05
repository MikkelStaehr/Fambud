'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { capLength, TEXT_LIMITS } from '@/lib/format';
import { setAuthStepCookie } from '@/lib/auth-step';
import { isCommonPassword } from '@/lib/common-passwords';

// Map a few common Supabase / Postgres error messages to Danish copy.
// Anything we don't recognise falls through verbatim.
//
// SECURITY: Vi mapper IKKE 'User already registered' til en specifik
// dansk besked længere - den lækkede info om at en email var
// registreret (user enumeration). Vi falder igennem til check-email-
// skærmen som om signup gik godt; i praksis re-sender Supabase også
// confirmation-mailen til den eksisterende konto. Angriberen kan
// ikke skelne ny vs eksisterende email fra response'en.
function localiseError(message: string): string {
  if (message.includes('Invalid or expired invite code')) {
    return 'Invitationen er udløbet eller findes ikke';
  }
  return message;
}

export async function signup(formData: FormData) {
  // SECURITY: Cap længden på alle fri-tekst-felter for at undgå
  // MB-store strenge der DoS'er DB / triggers.
  const email = capLength(String(formData.get('email') ?? '').trim(), TEXT_LIMITS.mediumName);
  const password = String(formData.get('password') ?? '');
  const householdName = capLength(String(formData.get('household_name') ?? '').trim(), TEXT_LIMITS.mediumName);
  const fullName = capLength(String(formData.get('full_name') ?? '').trim(), TEXT_LIMITS.shortName);
  const homeAddress = capLength(String(formData.get('home_address') ?? '').trim(), TEXT_LIMITS.mediumName);
  const homeZipCode = capLength(String(formData.get('home_zip_code') ?? '').trim(), 20);
  const homeCity = capLength(String(formData.get('home_city') ?? '').trim(), TEXT_LIMITS.shortName);
  const inviteCode = capLength(String(formData.get('invite_code') ?? '').trim().toUpperCase(), 20);

  if (password.length > 200) {
    redirect('/signup?error=' + encodeURIComponent('Adgangskode for lang'));
  }

  // When an invite code is in play, errors should land back on /join/[code]
  // - that's the page the visitor is actually looking at.
  const errorBase = inviteCode ? `/join/${encodeURIComponent(inviteCode)}` : '/signup';

  if (!email || !password) {
    redirect(`${errorBase}?error=` + encodeURIComponent('Udfyld alle felter'));
  }
  if (password.length < 8) {
    redirect(`${errorBase}?error=` + encodeURIComponent('Adgangskode skal være mindst 8 tegn'));
  }
  // Blokér passwords der står på vores liste over almindelige breach-
  // kandidater. Brugeren tvinges til at vælge noget mindre forudsigeligt
  // end "password123" eller "12345678".
  if (isCommonPassword(password)) {
    redirect(
      `${errorBase}?error=` +
        encodeURIComponent('Den adgangskode er for let at gætte - vælg noget mere unikt')
    );
  }

  // SECURITY: Rate limit per IP. Forhindrer mass-account-creation
  // (DB-bloat + auth.users-spam + Resend-quota-DoS via confirmation-
  // mails). 5/time er rigeligt til en familie der opretter et par
  // konti, og blokerer scripts.
  const ip = await getClientIp();
  const ipOk = await checkRateLimit(`ip:${ip}`, 'signup');
  if (!ipOk) {
    redirect(
      `${errorBase}?error=` +
        encodeURIComponent('For mange forsøg. Prøv igen om en time.')
    );
  }

  const supabase = await createClient();

  // raw_user_meta_data håndteres af handle_new_user-triggeren (migration
  // 0034). Den læser invite_code (path 1), household_name (path 3, ny
  // husstand), full_name + home_address (alle paths) og forfremmer dem
  // til family_members-rækken.
  const metaData: Record<string, string> = {};
  if (inviteCode) metaData.invite_code = inviteCode;
  if (householdName) metaData.household_name = householdName;
  if (fullName) metaData.full_name = fullName;
  if (homeAddress) metaData.home_address = homeAddress;
  if (homeZipCode) metaData.home_zip_code = homeZipCode;
  if (homeCity) metaData.home_city = homeCity;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: Object.keys(metaData).length > 0 ? { data: metaData } : undefined,
  });

  // SECURITY: 'User already registered' afsløres som check-email-
  // skærmen, ikke som en specifik fejl. En angriber kan ikke skelne
  // mellem ny og eksisterende email - begge fører til "vi har sendt
  // en mail" (Supabase re-sender også selv mailen til den eksisterende
  // konto, så der er ingen reel handlings-forskel).
  if (error?.message.includes('User already registered')) {
    await setAuthStepCookie({ step: 'check-email', email });
    redirect('/signup');
  }

  if (error || !data.user) {
    const msg = localiseError(error?.message ?? 'Kunne ikke oprette bruger');
    redirect(`${errorBase}?error=` + encodeURIComponent(msg));
  }

  // Email-confirmation flow: signUp returns user but no session.
  if (!data.session) {
    await setAuthStepCookie({ step: 'check-email', email });
    redirect('/signup');
  }

  // First-time signup → wizard. The (app) layout would redirect there anyway
  // if we sent them to /dashboard, but this saves a round-trip.
  revalidatePath('/', 'layout');
  redirect('/wizard');
}
