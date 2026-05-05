'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseRequiredAmount, capLength, TEXT_LIMITS } from '@/lib/format';
import { setFlashCookie } from '@/lib/flash';
import { assertAccountKind, POSTER_KINDS } from '@/lib/actions/account-validation';
import { mapDbError } from '@/lib/actions/error-map';
import type { RecurrenceFreq } from '@/lib/database.types';

const VALID_FREQS: readonly RecurrenceFreq[] = [
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
];

function readTransactionForm(formData: FormData):
  | { error: string }
  | {
      data: {
        account_id: string;
        category_id: string;
        amount: number;
        description: string | null;
        occurs_on: string;
        recurrence: RecurrenceFreq;
        recurrence_until: string | null;
      };
    } {
  const account_id = String(formData.get('account_id') ?? '').trim();
  if (!account_id) return { error: 'Vælg en konto' };

  // Required because the cashflow forecast derives sign from category.kind -
  // an uncategorised transaction has no defined sign.
  const category_id = String(formData.get('category_id') ?? '').trim();
  if (!category_id) return { error: 'Vælg en kategori' };

  const amountRes = parseRequiredAmount(
    String(formData.get('amount') ?? ''),
    'Beløb',
    { allowZero: true }
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

  // recurrence_until is meaningful only for repeating transactions; force null
  // when recurrence is 'once' so the column reflects intent regardless of UI bugs.
  const untilRaw = String(formData.get('recurrence_until') ?? '').trim();
  const recurrence_until = recurrence === 'once' ? null : untilRaw || null;

  const descRaw = capLength(String(formData.get('description') ?? '').trim(), TEXT_LIMITS.description);
  const description = descRaw || null;

  return {
    data: { account_id, category_id, amount, description, occurs_on, recurrence, recurrence_until },
  };
}

export async function createTransaction(formData: FormData) {
  const parsed = readTransactionForm(formData);
  if ('error' in parsed) {
    redirect('/poster/ny?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();

  // SECURITY: Bekræft at account_id er en konto-type der må modtage
  // transactions via /poster. Specielt UDELUKKER vi 'credit' (lån/
  // kreditkort) og 'investment' - de har deres egne dedikerede flows
  // (laan/actions.ts pushLoanToBudget, ingen direkte for investment
  // pt). Uden tjekket kunne et medlem indsætte en transaction på et
  // lån og forfalske afdrag.
  const accCheck = await assertAccountKind(
    supabase, householdId, parsed.data.account_id, POSTER_KINDS
  );
  if (!accCheck.ok) {
    redirect('/poster/ny?error=' + encodeURIComponent(accCheck.error));
  }

  const { error } = await supabase.from('transactions').insert({
    household_id: householdId,
    ...parsed.data,
  });
  if (error) {
    console.error('createTransaction failed:', error.message);
    redirect('/poster/ny?error=' + encodeURIComponent(mapDbError(error, 'Posten kunne ikke gemmes - tjek felterne')));
  }

  revalidatePath('/poster');
  revalidatePath('/dashboard');
  await setFlashCookie('Post oprettet');
  redirect('/poster');
}

export async function updateTransaction(id: string, formData: FormData) {
  const parsed = readTransactionForm(formData);
  if ('error' in parsed) {
    redirect(`/poster/${encodeURIComponent(id)}?error=` + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();

  // Samme account-kind-tjek som ved create - hvis brugeren ændrer
  // account_id til et lån, skal det blokeres.
  const accCheck = await assertAccountKind(
    supabase, householdId, parsed.data.account_id, POSTER_KINDS
  );
  if (!accCheck.ok) {
    redirect(`/poster/${encodeURIComponent(id)}?error=` + encodeURIComponent(accCheck.error));
  }

  const { error } = await supabase
    .from('transactions')
    .update(parsed.data)
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('updateTransaction failed:', error.message);
    redirect(`/poster/${encodeURIComponent(id)}?error=` + encodeURIComponent(mapDbError(error, 'Posten kunne ikke gemmes')));
  }

  revalidatePath('/poster');
  revalidatePath('/dashboard');
  await setFlashCookie('Post gemt');
  redirect('/poster');
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }
  revalidatePath('/poster');
  revalidatePath('/dashboard');
  await setFlashCookie('Post slettet');
  redirect('/poster');
}
