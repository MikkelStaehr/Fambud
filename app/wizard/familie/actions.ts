'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';

// Tilføj partner: family_member-række med email men ingen user_id endnu.
// Når partneren senere bruger invitations-koden vil /join koble user_id +
// joined_at + role='member' på den eksisterende række via email-match.
export async function addPartner(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!name) {
    redirect('/wizard/familie?type=family&error=' + encodeURIComponent('Navn er påkrævet'));
  }
  if (!email || !email.includes('@')) {
    redirect(
      '/wizard/familie?type=family&error=' +
        encodeURIComponent('Ugyldig email')
    );
  }

  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId } = await getHouseholdContext();
  // Pre-godkendt: role bliver 'member' når partneren joiner. For nu
  // sættes user_id + joined_at + role til null. Email er det der gør
  // at /join kan matche partneren til denne række.
  const { error } = await supabase.from('family_members').insert({
    household_id: householdId,
    name,
    email,
    user_id: null,
    role: null,
  });
  if (error) {
    redirect(
      '/wizard/familie?type=family&error=' + encodeURIComponent(error.message)
    );
  }

  revalidatePath('/wizard/familie');
  redirect('/wizard/familie?type=family');
}

// Tilføj barn: family_member uden email og uden user_id. Bruges som
// ejer på børneforbrugskonti og børneopsparing senere i wizarden.
// role=null markerer "dependent" (ingen login).
export async function addChild(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect('/wizard/familie?type=family&error=' + encodeURIComponent('Navn er påkrævet'));
  }

  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase.from('family_members').insert({
    household_id: householdId,
    name,
    email: null,
    user_id: null,
    role: null,
  });
  if (error) {
    redirect(
      '/wizard/familie?type=family&error=' + encodeURIComponent(error.message)
    );
  }

  revalidatePath('/wizard/familie');
  redirect('/wizard/familie?type=family');
}

// Slet pre-godkendt partner eller barn. Vi blokerer mod at fjerne ejeren
// selv (deres family_member-række er knyttet til auth.users og må aldrig
// nukes via wizard).
export async function removeFamilyMember(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // Sikkerhed: forhindrer at ejeren kan fjerne sin egen profil. Vi læser
  // rækken først og afviser hvis user_id matcher current user.
  const { data: target } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('id', id)
    .eq('household_id', householdId)
    .maybeSingle();
  if (target?.user_id === user.id) {
    redirect(
      '/wizard/familie?type=family&error=' +
        encodeURIComponent('Du kan ikke fjerne dig selv')
    );
  }

  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect(
      '/wizard/familie?type=family&error=' + encodeURIComponent(error.message)
    );
  }

  revalidatePath('/wizard/familie');
  redirect('/wizard/familie?type=family');
}
