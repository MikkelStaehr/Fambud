'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import {
  parseAmountToOere,
  parseOptionalAmount,
  nextOccurrenceAfter,
} from '@/lib/format';
import { noticeUrl } from '@/lib/flash';
import type { LoanType, RecurrenceFreq } from '@/lib/database.types';

const VALID_LOAN_TYPES: readonly LoanType[] = [
  'kreditkort',
  'realkredit',
  'banklan',
  'kassekredit',
  'andet',
];

const VALID_INTERVALS: readonly RecurrenceFreq[] = [
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
];

function parsePct(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

type ParsedLoan = {
  name: string;
  owner_name: string | null;
  loan_type: LoanType | null;
  lender: string | null;
  opening_balance: number;
  original_principal: number | null;
  payment_amount: number | null;
  payment_interval: RecurrenceFreq;
  payment_start_date: string | null;
  payment_rente: number | null;
  payment_afdrag: number | null;
  payment_bidrag: number | null;
  payment_rabat: number | null;
  term_months: number | null;
  interest_rate: number | null;
  apr: number | null;
};

function readLoanForm(formData: FormData):
  | { error: string }
  | { data: ParsedLoan } {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Navn er påkrævet' };

  const ownership = String(formData.get('ownership') ?? 'personal');
  const owner_name = ownership === 'shared' ? 'Fælles' : null;

  const loanTypeRaw = String(formData.get('loan_type') ?? '').trim();
  const loan_type = loanTypeRaw && VALID_LOAN_TYPES.includes(loanTypeRaw as LoanType)
    ? (loanTypeRaw as LoanType)
    : null;

  const lenderRaw = String(formData.get('lender') ?? '').trim();
  const lender = lenderRaw || null;

  // opening_balance on a loan account is restgæld stored as a negative number
  // (consistent with how credit-cards and the rest of the app treat debt as
  // signed bigint). Users routinely type the positive number - we auto-negate
  // so they don't have to remember the convention.
  const balanceRaw = String(formData.get('opening_balance') ?? '').trim();
  let opening_balance = 0;
  if (balanceRaw) {
    const v = parseAmountToOere(balanceRaw);
    if (v === null) return { error: 'Ugyldig gæld' };
    opening_balance = v === 0 ? 0 : -Math.abs(v);
  }

  const principal = parseOptionalAmount(
    String(formData.get('original_principal') ?? ''),
    'Hovedstol'
  );
  if (!principal.ok) return { error: principal.error };

  const payment = parseOptionalAmount(
    String(formData.get('payment_amount') ?? ''),
    'Samlet ydelse'
  );
  if (!payment.ok) return { error: payment.error };

  const intervalRaw = String(formData.get('payment_interval') ?? 'monthly');
  if (!VALID_INTERVALS.includes(intervalRaw as RecurrenceFreq)) {
    return { error: 'Ugyldigt betalingsinterval' };
  }
  const payment_interval = intervalRaw as RecurrenceFreq;

  const startDateRaw = String(formData.get('payment_start_date') ?? '').trim();
  const payment_start_date =
    startDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(startDateRaw) ? startDateRaw : null;

  const rente = parseOptionalAmount(
    String(formData.get('payment_rente') ?? ''),
    'Rente'
  );
  if (!rente.ok) return { error: rente.error };
  const afdrag = parseOptionalAmount(
    String(formData.get('payment_afdrag') ?? ''),
    'Afdrag'
  );
  if (!afdrag.ok) return { error: afdrag.error };
  const bidrag = parseOptionalAmount(
    String(formData.get('payment_bidrag') ?? ''),
    'Bidrag'
  );
  if (!bidrag.ok) return { error: bidrag.error };
  // Rabat (KundeKroner) er negativ - derfor allowNegative.
  const rabat = parseOptionalAmount(
    String(formData.get('payment_rabat') ?? ''),
    'Rabat',
    { allowNegative: true }
  );
  if (!rabat.ok) return { error: rabat.error };

  // Auto-compute payment_amount from breakdown if user didn't enter it
  // explicitly but did fill the breakdown - saves them from typing the sum.
  let payment_amount = payment.value;
  const anyBreakdown =
    rente.value != null || afdrag.value != null || bidrag.value != null || rabat.value != null;
  if (payment_amount == null && anyBreakdown) {
    payment_amount =
      (rente.value ?? 0) + (afdrag.value ?? 0) + (bidrag.value ?? 0) + (rabat.value ?? 0);
  }

  const termRaw = String(formData.get('term_months') ?? '').trim();
  let term_months: number | null = null;
  if (termRaw) {
    const n = Number(termRaw);
    if (!Number.isFinite(n) || n <= 0) return { error: 'Løbetid skal være et positivt tal' };
    term_months = Math.floor(n);
  }

  const interest_rate = parsePct(String(formData.get('interest_rate') ?? ''));
  const apr = parsePct(String(formData.get('apr') ?? ''));

  return {
    data: {
      name,
      owner_name,
      loan_type,
      lender,
      opening_balance,
      original_principal: principal.value,
      payment_amount,
      payment_interval,
      payment_start_date,
      payment_rente: rente.value,
      payment_afdrag: afdrag.value,
      payment_bidrag: bidrag.value,
      payment_rabat: rabat.value,
      term_months,
      interest_rate,
      apr,
    },
  };
}

export async function createLoan(formData: FormData) {
  const parsed = readLoanForm(formData);
  if ('error' in parsed) {
    redirect('/laan/ny?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId, user } = await getHouseholdContext();
  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    kind: 'credit',
    editable_by_all: true,
    created_by: user.id,
    ...parsed.data,
  });
  if (error) {
    redirect('/laan/ny?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/laan');
  revalidatePath('/konti');
  redirect(noticeUrl('/laan', `${parsed.data.name} oprettet`));
}

export async function updateLoan(id: string, formData: FormData) {
  const parsed = readLoanForm(formData);
  if ('error' in parsed) {
    redirect(`/laan/${encodeURIComponent(id)}?error=` + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .update(parsed.data)
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect(`/laan/${encodeURIComponent(id)}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath('/laan');
  revalidatePath('/konti');
  redirect(noticeUrl('/laan', `${parsed.data.name} gemt`));
}

export async function deleteLoan(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)
    .eq('kind', 'credit');
  if (error) throw new Error(error.message);
  revalidatePath('/laan');
  revalidatePath('/konti');
  redirect(noticeUrl('/laan', 'Lån slettet'));
}

// "Tilføj som ydelse på Budgetkonto X" - creates a recurring expense on
// `account_id` mirroring the loan's payment_amount + interval, with the
// loan's name as the description. Categorised under 'Lån' (created on demand
// if missing, same idempotent pattern as 'Løn' for income).
//
// If the loan has a payment breakdown (rente / afdrag / bidrag / rabat),
// we also create transaction_components with components_mode='breakdown' so
// the budget view shows the same decomposition.
export async function pushLoanToBudget(loanId: string, formData: FormData) {
  const accountId = String(formData.get('account_id') ?? '').trim();
  if (!accountId) {
    redirect(`/laan/${encodeURIComponent(loanId)}?error=` + encodeURIComponent('Vælg en budgetkonto'));
  }

  const { supabase, householdId } = await getHouseholdContext();

  const { data: loan, error: loanErr } = await supabase
    .from('accounts')
    .select(
      'name, payment_amount, payment_interval, payment_start_date, payment_rente, payment_afdrag, payment_bidrag, payment_rabat, opening_balance, interest_rate'
    )
    .eq('id', loanId)
    .eq('household_id', householdId)
    .eq('kind', 'credit')
    .single();
  if (loanErr) throw new Error(loanErr.message);
  if (!loan.payment_amount || loan.payment_amount <= 0) {
    redirect(
      `/laan/${encodeURIComponent(loanId)}?error=` +
        encodeURIComponent('Udfyld samlet ydelse på lånet før det kan lægges på budget')
    );
  }

  // Lookup-or-create 'Lån' category. Same pattern as 'Løn' for income.
  let categoryId: string;
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('name', 'Lån')
    .eq('kind', 'expense')
    .maybeSingle();
  if (existing?.id) {
    categoryId = existing.id;
  } else {
    const { data: created, error: catErr } = await supabase
      .from('categories')
      .insert({ household_id: householdId, name: 'Lån', kind: 'expense', color: '#dc2626' })
      .select('id')
      .single();
    if (catErr) throw new Error(catErr.message);
    categoryId = created.id;
  }

  // occurs_on = next future occurrence based on the loan's anchor date +
  // interval. If the user entered "31.03.2026" as their last payment and
  // interval is quarterly, this rolls forward to the upcoming 30.06.2026
  // (or whichever future date matches). Falls back to today if no anchor.
  let occurs_on: string;
  if (loan.payment_start_date) {
    occurs_on = nextOccurrenceAfter(loan.payment_start_date, loan.payment_interval);
  } else {
    const today = new Date();
    occurs_on = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  // Build components from explicit breakdown if available.
  const explicitBreakdown =
    loan.payment_rente != null ||
    loan.payment_afdrag != null ||
    loan.payment_bidrag != null ||
    loan.payment_rabat != null;

  const components: { label: string; amount: number; position: number }[] = [];
  let pos = 0;
  if (explicitBreakdown) {
    if (loan.payment_rente != null)
      components.push({ label: 'Rente', amount: loan.payment_rente, position: pos++ });
    if (loan.payment_afdrag != null)
      components.push({ label: 'Afdrag', amount: loan.payment_afdrag, position: pos++ });
    if (loan.payment_bidrag != null)
      components.push({ label: 'Bidrag', amount: loan.payment_bidrag, position: pos++ });
    if (loan.payment_rabat != null)
      // Stored signed (negative for KundeKroner) and pushed as-is. Migration
      // 0019 dropped the amount >= 0 check on transaction_components so
      // components can naturally sum to the parent total.
      components.push({ label: 'Rabat', amount: loan.payment_rabat, position: pos++ });
  } else if (loan.interest_rate != null && loan.opening_balance < 0) {
    // No explicit breakdown but we have rente% + restgæld - derive a rente
    // estimate so the budget shows where the cashflow goes. Most users
    // forget to count rente when laying out their budget, which is exactly
    // where this should help. The derived split is a snapshot of the FIRST
    // payment; for an annuitetslån it shifts month-to-month, but as an
    // overview it's the right ballpark.
    const periodsPerYear =
      { once: 0, weekly: 52, monthly: 12, quarterly: 4, semiannual: 2, yearly: 1 }[
        loan.payment_interval
      ] ?? 0;
    if (periodsPerYear > 0) {
      const restgaeld = -loan.opening_balance;
      const rentePerPeriod = Math.round(
        (restgaeld * (loan.interest_rate / 100)) / periodsPerYear
      );
      const afdragPerPeriod = loan.payment_amount - rentePerPeriod;
      // Only auto-derive if the result is sensible (positive afdrag).
      if (rentePerPeriod > 0 && afdragPerPeriod > 0) {
        components.push({ label: 'Rente (estimat)', amount: rentePerPeriod, position: pos++ });
        components.push({ label: 'Afdrag (estimat)', amount: afdragPerPeriod, position: pos++ });
      }
    }
  }

  const useBreakdownMode = components.length > 0;

  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .insert({
      household_id: householdId,
      account_id: accountId,
      category_id: categoryId,
      amount: loan.payment_amount,
      description: loan.name,
      occurs_on,
      recurrence: loan.payment_interval,
      // breakdown-mode: parent IS the total; components are informational.
      // Cashflow stays exactly equal to payment_amount regardless of the
      // sum of components.
      components_mode: useBreakdownMode ? 'breakdown' : 'additive',
    })
    .select('id')
    .single();
  if (txErr) {
    redirect(`/laan/${encodeURIComponent(loanId)}?error=` + encodeURIComponent(txErr.message));
  }

  if (useBreakdownMode) {
    const { error: compErr } = await supabase.from('transaction_components').insert(
      components.map((c) => ({
        household_id: householdId,
        transaction_id: tx.id,
        label: c.label,
        amount: c.amount,
        position: c.position,
      }))
    );
    if (compErr) {
      redirect(
        `/laan/${encodeURIComponent(loanId)}?error=` +
          encodeURIComponent('Lån oprettet på budget, men nedbrydning fejlede: ' + compErr.message)
      );
    }
  }

  // Look up the budget account's name so we can show a confirmation toast
  // on redirect ("Tilføjet på X"). Cheap one-row read; failure is non-fatal
  // - we just fall back to a generic message.
  const { data: targetAccount } = await supabase
    .from('accounts')
    .select('name')
    .eq('id', accountId)
    .eq('household_id', householdId)
    .single();

  revalidatePath('/laan');
  revalidatePath('/faste-udgifter', 'layout');
  revalidatePath('/budget');
  revalidatePath('/poster');
  revalidatePath('/dashboard');
  const message = targetAccount?.name
    ? `Tilføjet på ${targetAccount.name}`
    : 'Tilføjet på budget';
  redirect(noticeUrl(`/laan/${encodeURIComponent(loanId)}`, message));
}
