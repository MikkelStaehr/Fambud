'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseOptionalAmount, parseRequiredAmount, capLength, TEXT_LIMITS } from '@/lib/format';
import { noticeUrl } from '@/lib/flash';
import { assertAccountKind, POSTER_KINDS } from '@/lib/actions/account-validation';
import type {
  IncomeRole,
  PrimaryIncomeSource,
  RecurrenceFreq,
} from '@/lib/database.types';

const VALID_FREQS: readonly RecurrenceFreq[] = [
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
];

const VALID_INCOME_ROLES: readonly IncomeRole[] = ['primary', 'secondary'];

const VALID_PRIMARY_SOURCES: readonly PrimaryIncomeSource[] = ['salary', 'benefits'];

// Income gets its own form / action pair so we don't have to conditionally
// expose pension fields in the generic TransactionForm. Behind the scenes
// it still writes to `transactions` with the household's 'Løn' (income)
// category - looked up or created on demand, same pattern as the wizard.

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
  other_deduction_amount: number | null;
  other_deduction_label: string | null;
  income_role: IncomeRole | null;
  tax_rate_pct: number | null;
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

  const amountRes = parseRequiredAmount(
    String(formData.get('amount') ?? ''),
    'Nettoløn',
    { allowZero: true }
  );
  if (!amountRes.ok) return { error: amountRes.error };
  const amount = amountRes.value;

  const occurs_on = String(formData.get('occurs_on') ?? '').trim();
  if (!occurs_on) return { error: 'Dato er påkrævet' };

  const recurrenceRaw = String(formData.get('recurrence') ?? 'monthly');
  if (!VALID_FREQS.includes(recurrenceRaw as RecurrenceFreq)) {
    return { error: 'Ugyldig gentagelse' };
  }
  const recurrence = recurrenceRaw as RecurrenceFreq;

  const untilRaw = String(formData.get('recurrence_until') ?? '').trim();
  const recurrence_until = recurrence === 'once' ? null : untilRaw || null;

  const descRaw = capLength(String(formData.get('description') ?? '').trim(), TEXT_LIMITS.description);
  const description = descRaw || null;

  // Optional gross + pension. Empty strings parse to null; non-empty must be
  // valid. We don't reject "0%" as invalid - explicit zero may be meaningful.
  const grossRes = parseOptionalAmount(
    String(formData.get('gross_amount') ?? ''),
    'Bruttoløn'
  );
  if (!grossRes.ok) return { error: grossRes.error };
  const gross_amount = grossRes.value;

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

  const deductionRes = parseOptionalAmount(
    String(formData.get('other_deduction_amount') ?? ''),
    'Fradrag'
  );
  if (!deductionRes.ok) return { error: deductionRes.error };

  // Label is only meaningful when there's an amount. Strip a label that sits
  // alone so we don't accumulate orphan strings.
  const labelRaw = capLength(String(formData.get('other_deduction_label') ?? '').trim(), TEXT_LIMITS.shortName);
  const other_deduction_label = deductionRes.value != null && labelRaw ? labelRaw : null;

  // income_role: hovedindkomst eller biindkomst. Tom værdi → null (uklassificeret).
  // UI'et sætter denne via en hidden input afhængig af hvilket flow brugeren
  // kommer fra (lønudbetaling-flow → 'primary').
  const roleRaw = String(formData.get('income_role') ?? '').trim();
  let income_role: IncomeRole | null = null;
  if (roleRaw) {
    if (!VALID_INCOME_ROLES.includes(roleRaw as IncomeRole)) {
      return { error: 'Ugyldig indkomst-rolle' };
    }
    income_role = roleRaw as IncomeRole;
  }

  // Trækprocent - bruges sammen med skattefradrag til at forudsige netto.
  // Genbruger parsePct (0-100, accepterer komma-decimal).
  const taxRateRaw = String(formData.get('tax_rate_pct') ?? '').trim();
  const tax_rate_pct = taxRateRaw === '' ? null : parsePct(taxRateRaw);
  if (tax_rate_pct === null && taxRateRaw !== '') {
    return { error: 'Trækprocent skal være mellem 0 og 100' };
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
      other_deduction_amount: deductionRes.value,
      other_deduction_label,
      income_role,
      tax_rate_pct,
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

  // SECURITY: Indkomst lander på checking/savings/etc - ikke på lån.
  const accCheck = await assertAccountKind(
    supabase, householdId, parsed.data.account_id, POSTER_KINDS
  );
  if (!accCheck.ok) {
    redirect('/indkomst/ny?error=' + encodeURIComponent(accCheck.error));
  }

  const categoryId = await getOrCreateIncomeCategoryId(supabase, householdId);

  const { error } = await supabase.from('transactions').insert({
    household_id: householdId,
    category_id: categoryId,
    ...parsed.data,
  });
  if (error) {
    console.error('createIncome failed:', error.message);
    redirect('/indkomst/ny?error=' + encodeURIComponent('Indkomsten kunne ikke gemmes'));
  }

  revalidatePath('/indkomst');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
  redirect(noticeUrl('/indkomst', 'Indkomst registreret'));
}

export async function updateIncome(id: string, formData: FormData) {
  const parsed = readIncomeForm(formData);
  if ('error' in parsed) {
    redirect(`/indkomst/${encodeURIComponent(id)}?error=` + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();

  // Same kind-validation as createIncome - hvis brugeren ændrer
  // account_id til et lån, skal det blokeres.
  const accCheck = await assertAccountKind(
    supabase, householdId, parsed.data.account_id, POSTER_KINDS
  );
  if (!accCheck.ok) {
    redirect(`/indkomst/${encodeURIComponent(id)}?error=` + encodeURIComponent(accCheck.error));
  }

  const { error } = await supabase
    .from('transactions')
    .update(parsed.data)
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('updateIncome failed:', error.message);
    redirect(`/indkomst/${encodeURIComponent(id)}?error=` + encodeURIComponent('Indkomsten kunne ikke gemmes'));
  }

  revalidatePath('/indkomst');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
  redirect(noticeUrl('/indkomst', 'Indkomst gemt'));
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
  redirect(noticeUrl('/indkomst', 'Indkomst slettet'));
}

// Vælger en families primære indkomst-kilde. Styrer hvilken UI-flow vi guider
// dem ind i (lønseddel-builder vs. ydelse). Tom value rydder feltet.
export async function setPrimaryIncomeSource(formData: FormData) {
  const familyMemberId = String(formData.get('family_member_id') ?? '').trim();
  if (!familyMemberId) {
    redirect('/indkomst?error=' + encodeURIComponent('Vælg et familiemedlem'));
  }
  const sourceRaw = String(formData.get('primary_income_source') ?? '').trim();
  let primary_income_source: PrimaryIncomeSource | null = null;
  if (sourceRaw) {
    if (!VALID_PRIMARY_SOURCES.includes(sourceRaw as PrimaryIncomeSource)) {
      redirect('/indkomst?error=' + encodeURIComponent('Ugyldig indkomst-kilde'));
    }
    primary_income_source = sourceRaw as PrimaryIncomeSource;
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('family_members')
    .update({ primary_income_source })
    .eq('id', familyMemberId)
    .eq('household_id', householdId);
  if (error) {
    redirect('/indkomst?error=' + encodeURIComponent('Operationen fejlede - prøv igen'));
  }

  revalidatePath('/indkomst');
  revalidatePath('/dashboard');
  redirect(noticeUrl('/indkomst', 'Indkomst-kilde gemt'));
}
