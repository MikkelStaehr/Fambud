'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere } from '@/lib/format';
import {
  nextFixedDayOccurrence,
  nextLastBankingDay,
  nextMonthOccurrence,
  toISODate,
} from '@/lib/banking-days';
import type { RecurrenceFreq } from '@/lib/database.types';

const VALID_RECURRENCES: readonly RecurrenceFreq[] = [
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
];

function bounceWithError(accountId: string, msg: string): never {
  redirect(
    `/budget/${encodeURIComponent(accountId)}?error=${encodeURIComponent(msg)}`
  );
}

export async function addExpense(formData: FormData) {
  const accountId = String(formData.get('account_id') ?? '').trim();
  if (!accountId) redirect('/budget');

  const description = String(formData.get('description') ?? '').trim();
  if (!description) bounceWithError(accountId, 'Navn er påkrævet');

  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount <= 0) {
    bounceWithError(accountId, 'Indtast et beløb større end 0');
  }

  const categoryId = String(formData.get('category_id') ?? '').trim();
  if (!categoryId) bounceWithError(accountId, 'Vælg en kategori');

  const recurrenceRaw = String(formData.get('recurrence') ?? 'monthly');
  if (!VALID_RECURRENCES.includes(recurrenceRaw as RecurrenceFreq)) {
    bounceWithError(accountId, 'Ugyldig gentagelse');
  }
  const recurrence = recurrenceRaw as RecurrenceFreq;

  // Compute first occurrence based on recurrence.
  //   monthly:    fast-dato (with weekend → previous Friday) or last-bankday
  //   non-monthly: month picker → 1st of that month, this year if future,
  //                else next year. Day-rules don't apply because the user
  //                only specified a month, not a day.
  let occurs_on: string;
  const today = new Date();
  if (recurrence === 'monthly') {
    const dayRule = String(formData.get('day_rule') ?? 'fixed');
    if (dayRule === 'last-banking-day') {
      occurs_on = toISODate(nextLastBankingDay(today));
    } else {
      const day = Number(formData.get('day_of_month') ?? '1');
      if (!Number.isFinite(day) || day < 1 || day > 31) {
        bounceWithError(accountId, 'Ugyldig dag i måneden');
      }
      occurs_on = toISODate(nextFixedDayOccurrence(today, day));
    }
  } else {
    const month = Number(formData.get('first_month') ?? '0');
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      bounceWithError(accountId, 'Vælg en måned');
    }
    occurs_on = toISODate(nextMonthOccurrence(month, today));
  }

  // Optional grouping tag (e.g. "Popermo") that clusters expenses under a
  // common name within a category in the /budget overview. Empty → null.
  const groupLabelRaw = String(formData.get('group_label') ?? '').trim();
  const group_label = groupLabelRaw || null;

  // Components mode: when the breakdown checkbox is checked, components are
  // informational and effective = parent. Default 'additive' (tilkøb stack
  // on top of parent).
  const components_mode: 'additive' | 'breakdown' =
    formData.get('components_mode_breakdown') === 'on' ? 'breakdown' : 'additive';

  // Optional family-member tag. Empty string ("hele familien") → null.
  const familyRaw = String(formData.get('family_member_id') ?? '').trim();
  const family_member_id = familyRaw || null;

  const { supabase, householdId } = await getHouseholdContext();

  // can_write_account RLS policy enforces that the caller may write to this
  // account; we don't need an explicit ownership check here.
  const { error } = await supabase.from('transactions').insert({
    household_id: householdId,
    account_id: accountId,
    category_id: categoryId,
    amount: amount as number,
    description,
    occurs_on,
    recurrence,
    group_label,
    components_mode,
    family_member_id,
  });
  if (error) bounceWithError(accountId, error.message);

  revalidatePath(`/budget/${accountId}`);
  revalidatePath('/dashboard');
  revalidatePath('/poster');
}

export async function removeExpense(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const accountId = String(formData.get('account_id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error && accountId) bounceWithError(accountId, error.message);

  if (accountId) revalidatePath(`/budget/${accountId}`);
  revalidatePath('/dashboard');
  revalidatePath('/poster');
}

// Components: break a single recurring expense into named parts. The parent
// transaction's amount stays whatever the user set — we don't enforce that
// components sum to the parent. Real life: users often track only the
// "interesting" parts (rente + bidrag) and skip the trivial ones (afdrag).
export async function addComponent(formData: FormData) {
  const transactionId = String(formData.get('transaction_id') ?? '').trim();
  const accountId = String(formData.get('account_id') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();

  if (!accountId) redirect('/budget');
  if (!transactionId) bounceWithError(accountId, 'Manglende transaktion');
  if (!label) bounceWithError(accountId, 'Indtast et navn');

  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount < 0) {
    bounceWithError(accountId, 'Ugyldigt beløb');
  }

  const { supabase, householdId } = await getHouseholdContext();

  // Append to the end of the existing component list. We don't bother with
  // gap-numbering or reordering — sequence works fine here.
  const { data: last } = await supabase
    .from('transaction_components')
    .select('position')
    .eq('transaction_id', transactionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (last?.position ?? -1) + 1;

  const familyRaw = String(formData.get('family_member_id') ?? '').trim();
  const family_member_id = familyRaw || null;

  const { error } = await supabase.from('transaction_components').insert({
    household_id: householdId,
    transaction_id: transactionId,
    label,
    amount: amount as number,
    position: nextPos,
    family_member_id,
  });
  if (error) bounceWithError(accountId, error.message);

  revalidatePath(`/budget/${accountId}`);
}

export async function removeComponent(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const accountId = String(formData.get('account_id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transaction_components')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error && accountId) bounceWithError(accountId, error.message);

  if (accountId) revalidatePath(`/budget/${accountId}`);
}

// Inline-edit on a single component (label + amount). Returns state for
// useActionState so the inline form on /budget can close itself on success
// without redirecting.
export type UpdateComponentState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function updateComponent(
  componentId: string,
  accountId: string,
  _prevState: UpdateComponentState,
  formData: FormData
): Promise<UpdateComponentState> {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return { ok: false, error: 'Navn er påkrævet' };

  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount < 0) {
    return { ok: false, error: 'Ugyldigt beløb' };
  }

  const familyRaw = String(formData.get('family_member_id') ?? '').trim();
  const family_member_id = familyRaw || null;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transaction_components')
    .update({ label, amount: amount as number, family_member_id })
    .eq('id', componentId)
    .eq('household_id', householdId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/budget/${accountId}`);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Edit modal — designed to be driven by useActionState on the client
// ----------------------------------------------------------------------------
// Returns a discriminated UpdateState rather than redirecting, so the modal
// can stay on /budget/[accountId] and close itself after a successful save.
// The id and accountId are bound on the client via .bind(null, id, accountId)
// to keep the dispatch signature (prevState, formData) → state.
export type UpdateState = { ok: true } | { ok: false; error: string } | null;

export async function updateBudgetExpense(
  id: string,
  accountId: string,
  _prevState: UpdateState,
  formData: FormData
): Promise<UpdateState> {
  const description = String(formData.get('description') ?? '').trim();
  if (!description) return { ok: false, error: 'Navn er påkrævet' };

  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount <= 0) {
    return { ok: false, error: 'Indtast et beløb større end 0' };
  }

  const categoryId = String(formData.get('category_id') ?? '').trim();
  if (!categoryId) return { ok: false, error: 'Vælg en kategori' };

  const recurrenceRaw = String(formData.get('recurrence') ?? '');
  if (!VALID_RECURRENCES.includes(recurrenceRaw as RecurrenceFreq)) {
    return { ok: false, error: 'Ugyldig gentagelse' };
  }
  const recurrence = recurrenceRaw as RecurrenceFreq;

  const occurs_on = String(formData.get('occurs_on') ?? '').trim();
  if (!occurs_on || !/^\d{4}-\d{2}-\d{2}$/.test(occurs_on)) {
    return { ok: false, error: 'Vælg en gyldig dato' };
  }

  const groupLabelRaw = String(formData.get('group_label') ?? '').trim();
  const group_label = groupLabelRaw || null;

  const components_mode: 'additive' | 'breakdown' =
    formData.get('components_mode_breakdown') === 'on' ? 'breakdown' : 'additive';

  const familyRaw = String(formData.get('family_member_id') ?? '').trim();
  const family_member_id = familyRaw || null;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transactions')
    .update({
      description,
      amount: amount as number,
      category_id: categoryId,
      recurrence,
      occurs_on,
      group_label,
      components_mode,
      family_member_id,
    })
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/budget/${accountId}`);
  revalidatePath('/dashboard');
  revalidatePath('/poster');
  return { ok: true };
}
