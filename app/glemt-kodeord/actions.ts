'use server';

import { redirect } from 'next/navigation';
import { capLength, TEXT_LIMITS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { resolveSiteOrigin } from '@/lib/site-url';
import { setAuthStepCookie } from '@/lib/auth-step';
import { logAuditEvent, hashEmail } from '@/lib/audit-log';

export async function requestPasswordReset(formData: FormData) {
  const email = capLength(String(formData.get('email') ?? '').trim(), TEXT_LIMITS.mediumName);

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

  // Audit-log: vi tracker BÅDE eksisterende og ikke-eksisterende emails
  // som "requested" så vi kan se mistænkelig pattern-aktivitet (samme
  // IP der prøver mange emails). Vi gemmer email-hash, ikke rå email.
  await logAuditEvent({
    action: 'password.reset_requested',
    result: 'success',
    metadata: { email_hash: hashEmail(email) },
  });

  // Vi viser ALTID success-skærmen - også hvis emailen ikke findes.
  // Det forhindrer email-enumeration (en angriber kan ikke tjekke om
  // en konto eksisterer ved at prøve resetting på den).
  await setAuthStepCookie({ step: 'check-email', email });
  redirect('/glemt-kodeord');
}
