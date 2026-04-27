'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere } from '@/lib/format';

function parsePercentage(raw: string): number | null {
  const s = raw.trim().replace(/,/g, '.');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export async function createCreditLoan(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect('/wizard/kredit-laan?error=' + encodeURIComponent('Navn er påkrævet'));
  }

  const ownership = String(formData.get('ownership') ?? 'personal');
  const isShared = ownership === 'shared';

  const balanceRaw = String(formData.get('opening_balance') ?? '').trim();
  let opening_balance: number | undefined;
  if (balanceRaw) {
    const bal = parseAmountToOere(balanceRaw);
    if (bal === null) {
      redirect('/wizard/kredit-laan?error=' + encodeURIComponent('Ugyldig saldo'));
    }
    opening_balance = bal;
  }

  const interest_rate = parsePercentage(String(formData.get('interest_rate') ?? ''));
  const apr = parsePercentage(String(formData.get('apr') ?? ''));

  const { supabase, householdId, user } = await getHouseholdContext();
  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    name,
    // Shared shows owner_name='Fælles' in the UI; personal stays null and the
    // account is implicitly the creator's. editable_by_all stays true so a
    // bookkeeper-partner can still help — user can lock down later via /konti.
    owner_name: isShared ? 'Fælles' : null,
    kind: 'credit',
    editable_by_all: true,
    created_by: user.id,
    ...(opening_balance !== undefined ? { opening_balance } : {}),
    interest_rate,
    apr,
  });
  if (error) {
    redirect('/wizard/kredit-laan?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/kredit-laan');
}

export async function removeCreditLoan(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect('/wizard/kredit-laan?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/kredit-laan');
}
