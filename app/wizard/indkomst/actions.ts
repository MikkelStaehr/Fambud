'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere } from '@/lib/format';
import {
  nextFixedDayOccurrence,
  nextLastBankingDay,
  toISODate,
} from '@/lib/banking-days';

// Both roles continue to private savings next; the role-specific branching
// happens after that step.
function nextStepFor(_role: string | undefined): string {
  return '/wizard/privat-opsparing';
}

export async function createMonthlyIncome(formData: FormData) {
  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount <= 0) {
    redirect(
      '/wizard/indkomst?error=' + encodeURIComponent('Indtast et beløb større end 0')
    );
  }

  const account_id = String(formData.get('account_id') ?? '').trim();
  if (!account_id) {
    redirect(
      '/wizard/indkomst?error=' + encodeURIComponent('Du skal først oprette din lønkonto')
    );
  }

  // Compute occurs_on from the chosen rule. We don't (yet) persist the rule
  // itself; the forecast turn will add a column for that so multi-month
  // projections stay correct. For the wizard's first transaction this is
  // enough — the user sees the right date and recurrence='monthly' takes
  // care of the next month roughly.
  const dayRule = String(formData.get('day_rule') ?? 'fixed');
  const today = new Date();
  let occurs_on: string;
  if (dayRule === 'last-banking-day') {
    occurs_on = toISODate(nextLastBankingDay(today));
  } else {
    const dayOfMonth = Number(formData.get('day_of_month') ?? '1');
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      redirect(
        '/wizard/indkomst?error=' + encodeURIComponent('Ugyldig dag i måneden')
      );
    }
    occurs_on = toISODate(nextFixedDayOccurrence(today, dayOfMonth));
  }

  const description = String(formData.get('description') ?? '').trim() || 'Månedsløn';

  const { supabase, householdId, user } = await getHouseholdContext();

  // Use existing 'Løn'/income category if one exists, otherwise create it.
  // Tiny race window if two members run the wizard at the same instant —
  // worst case we end up with two 'Løn' rows; harmless and trivial to clean up.
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('name', 'Løn')
    .eq('kind', 'income')
    .maybeSingle();

  let categoryId = existing?.id;
  if (!categoryId) {
    const { data: created, error: catErr } = await supabase
      .from('categories')
      .insert({ household_id: householdId, name: 'Løn', kind: 'income', color: '#22c55e' })
      .select('id')
      .single();
    if (catErr) {
      redirect('/wizard/indkomst?error=' + encodeURIComponent(catErr.message));
    }
    categoryId = created!.id;
  }

  const { error: txErr } = await supabase.from('transactions').insert({
    household_id: householdId,
    account_id,
    category_id: categoryId,
    amount,
    description,
    occurs_on,
    recurrence: 'monthly',
  });
  if (txErr) {
    redirect('/wizard/indkomst?error=' + encodeURIComponent(txErr.message));
  }

  // Look up role to know where to send them next.
  const { data: membership } = await supabase
    .from('family_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  revalidatePath('/wizard');
  redirect(nextStepFor(membership?.role ?? undefined));
}
