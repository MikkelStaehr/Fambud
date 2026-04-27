'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Used by the "Log ud og brug invitation" button on /join/[code] when the
// visitor is already authenticated. Signs them out, then bounces back to the
// same code so they can sign up with a different account.
export async function signOutAndJoin(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim();
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect(code ? `/join/${encodeURIComponent(code)}` : '/login');
}
