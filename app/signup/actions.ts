'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Map a few common Supabase / Postgres error messages to Danish copy.
// Anything we don't recognise falls through verbatim.
function localiseError(message: string): string {
  if (message.includes('Invalid or expired invite code')) {
    return 'Invitationen er udløbet eller findes ikke';
  }
  if (message.includes('User already registered')) {
    return 'Der findes allerede en konto med den email';
  }
  return message;
}

export async function signup(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const householdName = String(formData.get('household_name') ?? '').trim();
  const inviteCode = String(formData.get('invite_code') ?? '').trim().toUpperCase();

  // When an invite code is in play, errors should land back on /join/[code]
  // — that's the page the visitor is actually looking at.
  const errorBase = inviteCode ? `/join/${encodeURIComponent(inviteCode)}` : '/signup';

  if (!email || !password) {
    redirect(`${errorBase}?error=` + encodeURIComponent('Udfyld alle felter'));
  }
  if (password.length < 6) {
    redirect(`${errorBase}?error=` + encodeURIComponent('Adgangskode skal være mindst 6 tegn'));
  }

  const supabase = await createClient();

  // Both household_name and invite_code go into raw_user_meta_data; the auth
  // trigger picks invite_code first and ignores household_name when it joins
  // an existing household.
  const metaData: Record<string, string> = {};
  if (inviteCode) metaData.invite_code = inviteCode;
  if (householdName) metaData.household_name = householdName;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: Object.keys(metaData).length > 0 ? { data: metaData } : undefined,
  });

  if (error || !data.user) {
    const msg = localiseError(error?.message ?? 'Kunne ikke oprette bruger');
    redirect(`${errorBase}?error=` + encodeURIComponent(msg));
  }

  // Email-confirmation flow: signUp returns user but no session.
  if (!data.session) {
    redirect('/signup?step=check-email&email=' + encodeURIComponent(email));
  }

  // First-time signup → wizard. The (app) layout would redirect there anyway
  // if we sent them to /dashboard, but this saves a round-trip.
  revalidatePath('/', 'layout');
  redirect('/wizard');
}
