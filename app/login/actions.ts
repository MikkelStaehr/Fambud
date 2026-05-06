'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SESSION_ONLY_COOKIE } from '@/lib/supabase/session-flag';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { capLength, TEXT_LIMITS } from '@/lib/format';
import { logAuditEvent, hashEmail } from '@/lib/audit-log';

export async function login(formData: FormData) {
  const email = capLength(String(formData.get('email') ?? '').trim(), TEXT_LIMITS.mediumName);
  const password = String(formData.get('password') ?? '');
  const rememberMe = formData.get('remember_me') === 'on';

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Udfyld alle felter'));
  }
  if (password.length > 200) {
    redirect('/login?error=' + encodeURIComponent('Forkert email eller adgangskode'));
  }

  // SECURITY: Rate limit per IP+email mod credential-stuffing.
  // Bevidst SAMME fejlbesked på rate-limit som på forkert password
  // så angriber ikke kan skelne 'rate-limit hit' fra 'wrong creds'.
  const ip = await getClientIp();
  const ipOk = await checkRateLimit(`ip:${ip}`, 'login');
  const emailOk = await checkRateLimit(`email:${email.toLowerCase()}`, 'login');
  if (!ipOk || !emailOk) {
    redirect('/login?error=' + encodeURIComponent('Forkert email eller adgangskode'));
  }

  const cookieStore = await cookies();
  if (rememberMe) {
    cookieStore.delete(SESSION_ONLY_COOKIE);
  } else {
    cookieStore.set(SESSION_ONLY_COOKIE, '1', {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Audit-log før redirect så vi har failed-login-trail uafhængigt
    // af om brugeren faktisk eksisterer (vi kan ikke skelne her).
    await logAuditEvent({
      action: 'login.failure',
      result: 'failure',
      metadata: { email_hash: hashEmail(email) },
    });
    redirect('/login?error=' + encodeURIComponent('Forkert email eller adgangskode'));
  }

  await logAuditEvent({
    action: 'login.success',
    result: 'success',
    user_id: data.user?.id ?? null,
  });

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
