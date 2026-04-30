'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';

// Same shape as createSharedAccount but the kind is fixed to 'savings' and
// editable_by_all is read from the form (default checked). Stays on the page
// after success so the user can add more.
export async function createPrivateSavings(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect(
      '/wizard/privat-opsparing?error=' + encodeURIComponent('Navn er påkrævet')
    );
  }

  const editable_by_all = formData.get('editable_by_all') === 'on';

  const { supabase, householdId, user } = await getHouseholdContext();
  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    name,
    owner_name: null,
    kind: 'savings',
    editable_by_all,
    created_by: user.id,
  });
  if (error) {
    redirect('/wizard/privat-opsparing?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/privat-opsparing');
}

// One-klik buffer-oprettelse fra anbefalings-kortet på samme side. Tagger
// kontoen med savings_purposes=['buffer'] så dashboardet og /opsparinger
// genkender den som "fundamentet" og ikke spørger igen.
export async function createBufferSavings() {
  const { supabase, householdId, user } = await getHouseholdContext();
  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    name: 'Buffer',
    owner_name: null,
    kind: 'savings',
    savings_purposes: ['buffer'],
    editable_by_all: true,
    created_by: user.id,
  });
  if (error) {
    redirect('/wizard/privat-opsparing?error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/wizard/privat-opsparing');
}

// Same hard-delete pattern as on faelleskonti — safe pre-transactions.
export async function removePrivateSavings(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect('/wizard/privat-opsparing?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/privat-opsparing');
}
