'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    redirect('/glemt-kodeord?error=' + encodeURIComponent('Indtast din email'));
  }

  // Vi bygger redirectTo dynamisk fra request-headers så det virker både
  // på prod, preview-deploys og lokalt - i stedet for at hardcode et domæne.
  // Supabase tjekker selv at URL'en er på allowlisten under
  // Authentication → URL Configuration → Redirect URLs.
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/nyt-kodeord`,
  });

  // Vi viser ALTID success-skærmen - også hvis emailen ikke findes.
  // Det forhindrer email-enumeration (en angriber kan ikke tjekke om
  // en konto eksisterer ved at prøve resetting på den).
  redirect('/glemt-kodeord?step=check-email&email=' + encodeURIComponent(email));
}
