'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';

// Generel privat opsparing — kind=savings, intet specifikt formål-tag.
// Forbliver på siden efter success så brugeren kan tilføje flere.
export async function createPrivateSavings(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect(
      '/wizard/opsparing?error=' + encodeURIComponent('Navn er påkrævet')
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
    redirect('/wizard/opsparing?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/opsparing');
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
    redirect('/wizard/opsparing?error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/wizard/opsparing');
}

// Børneforbrugskonto — én konto pr. barn til lommepenge, fritidsaktiviteter
// osv. Vi opretter den som kind=savings med owner_name=barnets navn så
// /opsparinger og cashflow-tjekket kan vise hvor meget der overføres pr. md
// til hvert barn. Skal kun tilbydes hvis barn-rækken faktisk eksisterer.
export async function createChildSpendingAccount(formData: FormData) {
  const childId = String(formData.get('child_id') ?? '').trim();
  if (!childId) {
    redirect('/wizard/opsparing?error=' + encodeURIComponent('Manglende barn-id'));
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // Læs barnets navn fra family_members. Vi tjekker både household_id-match
  // og at det rent faktisk er et barn (ingen email, ingen user_id) — det
  // forhindrer at en bruger fra et andet member ved et uheld bliver markeret
  // som ejer på en konto.
  const { data: child } = await supabase
    .from('family_members')
    .select('name, email, user_id')
    .eq('id', childId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (!child || child.email != null || child.user_id != null) {
    redirect(
      '/wizard/opsparing?error=' + encodeURIComponent('Ugyldigt barn')
    );
  }

  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    name: `Forbrug ${child.name}`,
    owner_name: child.name,
    kind: 'savings',
    editable_by_all: true,
    created_by: user.id,
  });
  if (error) {
    redirect('/wizard/opsparing?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/opsparing');
}

// Slet en opsparingskonto oprettet i wizarden. Hard-delete er sikker
// her fordi der endnu ikke er transaktioner på kontoen.
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
    redirect('/wizard/opsparing?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/opsparing');
}
