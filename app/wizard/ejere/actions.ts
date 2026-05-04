'use server';

import { redirect } from 'next/navigation';
import { capLength, TEXT_LIMITS } from '@/lib/format';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext, getMyMembership, guardWizardOpen } from '@/lib/dal';

// Sætter owner_name på en konto. Bruges i ejere-trinet hvor brugeren går
// igennem alle konti og bekræfter ejerskab. Tom streng → null = "personlig"
// (implicit ejet af den der oprettede kontoen). Alle andre værdier gemmes
// som-er - vi validerer ikke mod family_members navnene fordi det er
// almindelig tekst (kunne også være "Fælles").
export async function updateAccountOwner(formData: FormData) {
  await guardWizardOpen();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const ownerNameRaw = capLength(String(formData.get('owner_name') ?? '').trim(), TEXT_LIMITS.shortName);
  const owner_name = ownerNameRaw || null;

  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .update({ owner_name })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect('/wizard/ejere?error=' + encodeURIComponent('Operationen fejlede - prøv igen'));
  }

  revalidatePath('/wizard/ejere');
}
