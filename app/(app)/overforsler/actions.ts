'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseRequiredAmount, capLength, TEXT_LIMITS } from '@/lib/format';
import { noticeUrl } from '@/lib/flash';
import type { RecurrenceFreq } from '@/lib/database.types';

const VALID_FREQS: readonly RecurrenceFreq[] = [
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
];

function readTransferForm(formData: FormData):
  | { error: string }
  | {
      data: {
        from_account_id: string;
        to_account_id: string;
        amount: number;
        description: string | null;
        occurs_on: string;
        recurrence: RecurrenceFreq;
        recurrence_until: string | null;
      };
    } {
  const from_account_id = String(formData.get('from_account_id') ?? '').trim();
  const to_account_id = String(formData.get('to_account_id') ?? '').trim();
  if (!from_account_id || !to_account_id) return { error: 'Vælg begge konti' };
  // Mirrors the DB-level CHECK; we duplicate it here for a friendlier message.
  if (from_account_id === to_account_id) {
    return { error: 'Fra-konto og til-konto skal være forskellige' };
  }

  const amountRes = parseRequiredAmount(
    String(formData.get('amount') ?? ''),
    'Beløb'
  );
  if (!amountRes.ok) return { error: amountRes.error };
  const amount = amountRes.value;

  const occurs_on = String(formData.get('occurs_on') ?? '').trim();
  if (!occurs_on) return { error: 'Dato er påkrævet' };

  const recurrenceRaw = String(formData.get('recurrence') ?? 'once');
  if (!VALID_FREQS.includes(recurrenceRaw as RecurrenceFreq)) {
    return { error: 'Ugyldig gentagelse' };
  }
  const recurrence = recurrenceRaw as RecurrenceFreq;

  const untilRaw = String(formData.get('recurrence_until') ?? '').trim();
  const recurrence_until = recurrence === 'once' ? null : untilRaw || null;

  const descRaw = capLength(String(formData.get('description') ?? '').trim(), TEXT_LIMITS.description);
  const description = descRaw || null;

  return {
    data: { from_account_id, to_account_id, amount, description, occurs_on, recurrence, recurrence_until },
  };
}

export async function createTransfer(formData: FormData) {
  const parsed = readTransferForm(formData);
  if ('error' in parsed) {
    redirect('/overforsler/ny?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase.from('transfers').insert({
    household_id: householdId,
    ...parsed.data,
  });
  if (error) {
    redirect('/overforsler/ny?error=' + encodeURIComponent('Operationen fejlede - prøv igen'));
  }

  revalidatePath('/overforsler');
  revalidatePath('/dashboard');
  redirect(noticeUrl('/overforsler', 'Overførsel oprettet'));
}

export async function updateTransfer(id: string, formData: FormData) {
  const parsed = readTransferForm(formData);
  if ('error' in parsed) {
    redirect(
      `/overforsler/${encodeURIComponent(id)}?error=` + encodeURIComponent(parsed.error)
    );
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transfers')
    .update(parsed.data)
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect(
      `/overforsler/${encodeURIComponent(id)}?error=` + encodeURIComponent(error.message)
    );
  }

  revalidatePath('/overforsler');
  revalidatePath('/dashboard');
  redirect(noticeUrl('/overforsler', 'Overførsel gemt'));
}

export async function deleteTransfer(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transfers')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);
  revalidatePath('/overforsler');
  revalidatePath('/dashboard');
  redirect(noticeUrl('/overforsler', 'Overførsel slettet'));
}
