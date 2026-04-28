'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere } from '@/lib/format';
import type { RecurrenceFreq } from '@/lib/database.types';

const VALID_FREQS: readonly RecurrenceFreq[] = [
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
];

// Income gets its own form / action pair so we don't have to conditionally
// expose pension fields in the generic TransactionForm. Behind the scenes
// it still writes to `transactions` with the household's 'Løn' (income)
// category — looked up or created on demand, same pattern as the wizard.

type ParsedIncome = {
  account_id: string;
  family_member_id: string | null;
  amount: number;
  description: string | null;
  occurs_on: string;
  recurrence: RecurrenceFreq;
  recurrence_until: string | null;
  gross_amount: number | null;
  pension_own_pct: number | null;
  pension_employer_pct: number | null;
};

function parsePct(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function readIncomeForm(formData: FormData):
  | { error: string }
  | { data: ParsedIncome } {
  const account_id = String(formData.get('account_id') ?? '').trim();
  if (!account_id) return { error: 'Vælg en konto' };

  const fmRaw = String(formData.get('family_member_id') ?? '').trim();
  const family_member_id = fmRaw || null;

  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount < 0) return { error: 'Nettoløn skal være et tal' };

  const occurs_on = String(formData.get('occurs_on') ?? '').trim();
  if (!occurs_on) return { error: 'Dato er påkrævet' };

  const recurrenceRaw = String(formData.get('recurrence') ?? 'monthly');
  if (!VALID_FREQS.includes(recurrenceRaw as RecurrenceFreq)) {
    return { error: 'Ugyldig gentagelse' };
  }
  const recurrence = recurrenceRaw as RecurrenceFreq;

  const untilRaw = String(formData.get('recurrence_until') ?? '').trim();
  const recurrence_until = recurrence === 'once' ? null : untilRaw || null;

  const descRaw = String(formData.get('description') ?? '').trim();
  const description = descRaw || null;

  // Optional gross + pension. Empty strings parse to null; non-empty must be
  // valid. We don't reject "0%" as invalid — explicit zero may be meaningful.
  const grossRaw = String(formData.get('gross_amount') ?? '').trim();
  let gross_amount: number | null = null;
  if (grossRaw) {
    const g = parseAmountToOere(grossRaw);
    if (g === null || g < 0) return { error: 'Bruttoløn skal være et tal' };
    gross_amount = g;
  }

  const pension_own_pct =
    String(formData.get('pension_own_pct') ?? '').trim() === ''
      ? null
      : parsePct(String(formData.get('pension_own_pct') ?? ''));
  if (pension_own_pct === null && String(formData.get('pension_own_pct') ?? '').trim() !== '') {
    return { error: 'Pension egen skal være mellem 0 og 100' };
  }

  const pension_employer_pct =
    String(formData.get('pension_employer_pct') ?? '').trim() === ''
      ? null
      : parsePct(String(formData.get('pension_employer_pct') ?? ''));
  if (
    pension_employer_pct === null &&
    String(formData.get('pension_employer_pct') ?? '').trim() !== ''
  ) {
    return { error: 'Pension firma skal være mellem 0 og 100' };
  }

  return {
    data: {
      account_id,
      family_member_id,
      amount,
      description,
      occurs_on,
      recurrence,
      recurrence_until,
      gross_amount,
      pension_own_pct,
      pension_employer_pct,
    },
  };
}

// Lookup-or-create the household's income category. Same pattern as the
// wizard; the unique (household_id, name, kind) constraint from 0008 makes
// this race-safe via on-conflict.
async function getOrCreateIncomeCategoryId(
  supabase: Awaited<ReturnType<typeof getHouseholdContext>>['supabase'],
  householdId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('name', 'Løn')
    .eq('kind', 'income')
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('categories')
    .insert({ household_id: householdId, name: 'Løn', kind: 'income', color: '#22c55e' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

export async function createIncome(formData: FormData) {
  const parsed = readIncomeForm(formData);
  if ('error' in parsed) {
    redirect('/indkomst/ny?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();
  const categoryId = await getOrCreateIncomeCategoryId(supabase, householdId);

  const { error } = await supabase.from('transactions').insert({
    household_id: householdId,
    category_id: categoryId,
    ...parsed.data,
  });
  if (error) {
    redirect('/indkomst/ny?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/indkomst');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
  redirect('/indkomst');
}

export async function updateIncome(id: string, formData: FormData) {
  const parsed = readIncomeForm(formData);
  if ('error' in parsed) {
    redirect(`/indkomst/${encodeURIComponent(id)}?error=` + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();

  const { error } = await supabase
    .from('transactions')
    .update(parsed.data)
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect(`/indkomst/${encodeURIComponent(id)}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath('/indkomst');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
  redirect('/indkomst');
}

export async function deleteIncome(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);

  revalidatePath('/indkomst');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
}
