'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function setNewPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('password_confirm') ?? '');

  if (!password || !passwordConfirm) {
    redirect('/nyt-kodeord?error=' + encodeURIComponent('Udfyld begge felter'));
  }
  if (password.length < 6) {
    redirect(
      '/nyt-kodeord?error=' +
        encodeURIComponent('Adgangskode skal være mindst 6 tegn')
    );
  }
  if (password !== passwordConfirm) {
    redirect(
      '/nyt-kodeord?error=' + encodeURIComponent('De to adgangskoder er ikke ens')
    );
  }

  const supabase = await createClient();

  // Brugeren skal være authenticated for at sætte nyt password. Recovery-
  // link'et fra mailen har lige skiftet kode → session i /auth/callback,
  // så når de lander her er de logget ind med en recovery-session.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      '/login?error=' +
        encodeURIComponent('Bekræftelseslinket er udløbet. Bed om et nyt.')
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // SECURITY: Vi viser ikke raw Supabase-fejlen - den kan lække
    // intern info (validation-rules, JWT-claim-issues osv.) der hjælper
    // en angriber. Specielle kendte cases mappes til danske beskeder;
    // resten falder til en generisk fejl.
    let msg = 'Adgangskoden kunne ikke opdateres. Prøv igen.';
    if (error.message.includes('should be different')) {
      msg = 'Den nye adgangskode skal være forskellig fra den gamle';
    } else if (error.message.includes('Password')) {
      msg = 'Adgangskoden opfylder ikke kravene';
    }
    console.error('updateUser failed:', error.message);
    redirect('/nyt-kodeord?error=' + encodeURIComponent(msg));
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
