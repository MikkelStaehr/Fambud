'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isCommonPassword } from '@/lib/common-passwords';

export async function setNewPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('password_confirm') ?? '');

  if (!password || !passwordConfirm) {
    redirect('/nyt-kodeord?error=' + encodeURIComponent('Udfyld begge felter'));
  }
  if (password.length < 8) {
    redirect(
      '/nyt-kodeord?error=' +
        encodeURIComponent('Adgangskode skal være mindst 8 tegn')
    );
  }
  if (isCommonPassword(password)) {
    redirect(
      '/nyt-kodeord?error=' +
        encodeURIComponent('Den adgangskode er for let at gætte - vælg noget mere unikt')
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
  // SECURITY: Efter succesfuld password-skift logger vi ALLE andre
  // sessioner ud (på alle andre devices/browsers). Hvis en angriber
  // havde stjålet brugerens session før reset, ville den ellers
  // forblive aktiv indtil refresh-token udløb.
  if (!error) {
    try {
      await supabase.auth.signOut({ scope: 'others' });
    } catch (e) {
      console.error('signOut(others) after password change failed:', e);
    }
  }
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
