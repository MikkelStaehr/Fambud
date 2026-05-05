'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { capLength } from '@/lib/format';

// Used by the "Log ud og brug invitation" button on /join/[code] when the
// visitor is already authenticated. Signs them out, then bounces back to the
// same code so they can sign up with a different account.
export async function signOutAndJoin(formData: FormData) {
  // SECURITY: Rate limit per IP. Forhindrer en angriber i at loope
  // signOut globalt (delt med login-bucket - hvis du er igang med at
  // misbruge denne endpoint, vil du også være rate-limited på login).
  const ip = await getClientIp();
  const rateLimitOk = await checkRateLimit(`ip:${ip}`, 'login');
  if (!rateLimitOk) {
    redirect('/login?error=' + encodeURIComponent('For mange forsøg. Prøv igen om en time.'));
  }

  const code = capLength(String(formData.get('code') ?? '').trim(), 32);
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect(code ? `/join/${encodeURIComponent(code)}` : '/login');
}
