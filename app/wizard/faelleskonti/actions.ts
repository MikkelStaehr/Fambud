'use server';

import { redirect } from 'next/navigation';
import { capLength, TEXT_LIMITS } from '@/lib/format';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext, guardWizardOpen } from '@/lib/dal';

const SHARED_KINDS = ['budget', 'household', 'savings', 'other'] as const;
type SharedKind = (typeof SHARED_KINDS)[number];

// Add a single shared account. The form lives on the same /wizard/faelleskonti
// page, so after success we revalidate and stay on the page - the user can
// keep adding more, then click "Næste" to continue. Credit/loan accounts are
// handled in their own wizard step (/wizard/kredit-laan).
export async function createSharedAccount(formData: FormData) {
  await guardWizardOpen();
  const name = capLength(String(formData.get('name') ?? '').trim(), TEXT_LIMITS.shortName);
  if (!name) {
    redirect('/wizard/faelleskonti?error=' + encodeURIComponent('Navn er påkrævet'));
  }

  const kindRaw = String(formData.get('kind') ?? 'budget');
  const kind: SharedKind = SHARED_KINDS.includes(kindRaw as SharedKind)
    ? (kindRaw as SharedKind)
    : 'budget';

  const { supabase, householdId, user } = await getHouseholdContext();
  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    name,
    owner_name: 'Fælles',
    kind,
    editable_by_all: true,
    created_by: user.id,
  });
  if (error) {
    redirect('/wizard/faelleskonti?error=' + encodeURIComponent('Operationen fejlede - prøv igen'));
  }

  revalidatePath('/wizard/faelleskonti');
}

// Hard-delete an account that was just created in this wizard step. Safe
// because nothing references it yet (no transactions/transfers); the FK
// from transactions/transfers is ON DELETE RESTRICT, so the surface error
// is informative if the assumption ever breaks.
export async function removeSharedAccount(formData: FormData) {
  await guardWizardOpen();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect('/wizard/faelleskonti?error=' + encodeURIComponent('Operationen fejlede - prøv igen'));
  }

  revalidatePath('/wizard/faelleskonti');
}
