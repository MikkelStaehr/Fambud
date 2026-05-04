'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { resolveSiteOrigin } from '@/lib/site-url';

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    redirect('/glemt-kodeord?error=' + encodeURIComponent('Indtast din email'));
  }

  // SECURITY: Uden rate limit kunne en angriber loope reset-mails for
  // en liste af emails - drainer Supabase auth-mail-quota (delt med
  // signup, så normale brugere ikke kan logge ind), drainer Resend-
  // quota (3000/md gratis) og kan harassment-spamme tredjepart.
  // Vi limiterer på BÅDE IP og email - en angriber med mange IP'er
  // kan stadig spamme én konto, men ikke alle på én liste fra én IP.
  const ip = await getClientIp();
  const ipOk = await checkRateLimit(`ip:${ip}`, 'reset_password');
  const emailOk = await checkRateLimit(
    `email:${email.toLowerCase()}`,
    'reset_password'
  );
  if (!ipOk || !emailOk) {
    redirect(
      '/glemt-kodeord?error=' +
        encodeURIComponent('For mange forsøg. Prøv igen om en time.')
    );
  }

  // Vi bygger redirectTo fra SITE_URL env-var (hardcoded i Vercel) frem
  // for fra request-Host - Host kan spoofes, og selv om Supabase har en
  // redirect-URL-allowlist, er det defense-in-depth at undgå
  // attacker-controlled URL'er overhovedet.
  const origin = await resolveSiteOrigin();

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/nyt-kodeord`,
  });

  // Vi viser ALTID success-skærmen - også hvis emailen ikke findes.
  // Det forhindrer email-enumeration (en angriber kan ikke tjekke om
  // en konto eksisterer ved at prøve resetting på den).
  redirect('/glemt-kodeord?step=check-email&email=' + encodeURIComponent(email));
}
