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
    redirect('/nyt-kodeord?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
