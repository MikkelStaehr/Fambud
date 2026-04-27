'use server';

import { redirect } from 'next/navigation';

export async function joinByCode(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  if (!code) {
    redirect('/join?error=' + encodeURIComponent('Indtast en kode'));
  }
  redirect(`/join/${encodeURIComponent(code)}`);
}
