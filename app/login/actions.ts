'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SESSION_ONLY_COOKIE } from '@/lib/supabase/session-flag';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const rememberMe = formData.get('remember_me') === 'on';

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Udfyld alle felter'));
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect('/login?error=' + encodeURIComponent('Forkert email eller adgangskode'));
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
