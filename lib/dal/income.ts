// Income - convenience wrappers around income-category transactions samt
// hovedindkomst-forecast. We treat any transaction whose category.kind =
// 'income' as income; /indkomst-siden filtrerer og dekorerer med family-
// member tags og valgfri brutto/pension-felter.

import type { Account, Transaction } from '@/lib/database.types';
import { getHouseholdContext } from './auth';

export type IncomeRow = Pick<
  Transaction,
  | 'id'
  | 'account_id'
  | 'category_id'
  | 'amount'
  | 'description'
  | 'occurs_on'
  | 'recurrence'
  | 'recurrence_until'
  | 'family_member_id'
  | 'gross_amount'
  | 'pension_own_pct'
  | 'pension_employer_pct'
  | 'other_deduction_amount'
  | 'other_deduction_label'
  | 'income_role'
  | 'tax_rate_pct'
> & {
  account: Pick<Account, 'id' | 'name'> | null;
  family_member: { id: string; name: string } | null;
};

const INCOME_SELECT = `id, account_id, category_id, amount, description, occurs_on,
   recurrence, recurrence_until, family_member_id,
   gross_amount, pension_own_pct, pension_employer_pct,
   other_deduction_amount, other_deduction_label, income_role, tax_rate_pct,
   account:accounts(id, name),
   family_member:family_members(id, name)`;

export async function getIncomeTransactions(): Promise<IncomeRow[]> {
  const { supabase, householdId } = await getHouseholdContext();
  // !inner makes this filter via a join - PostgREST only allows filtering
  // through joined columns when the join is inner.
  const { data, error } = await supabase
    .from('transactions')
    .select(`${INCOME_SELECT}, category:categories!inner(kind)`)
    .eq('household_id', householdId)
    .eq('category.kind', 'income')
    .order('occurs_on', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<(IncomeRow & { category: { kind: 'income' } })[]>();

  if (error) throw error;
  // Strip the join-only `category` field - callers don't need it.
  return (data ?? []).map(({ category: _c, ...rest }) => rest);
}

export async function getIncomeById(id: string): Promise<IncomeRow> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select(INCOME_SELECT)
    .eq('id', id)
    .eq('household_id', householdId)
    .single<IncomeRow>();
  if (error) throw error;
  return data;
}

// "Min seneste lønudbetaling" - bruges til at pre-fylde formen for nye
// paychecks. Brutto, pension-procent, trækprocent, skattefradrag og konto
// ændrer sig sjældent; ved at hente dem fra sidste udbetaling sparer vi
// brugeren for at indtaste dem hver måned. Den ene ting der typisk varierer
// (netto pga. overtid, sygdom, ferie) lader vi stå tom.
export type RecentPaycheckDefaults = {
  account_id: string;
  gross_amount: number | null;
  pension_own_pct: number | null;
  pension_employer_pct: number | null;
  other_deduction_amount: number | null;
  tax_rate_pct: number | null;
};

export async function getMostRecentPaycheck(
  familyMemberId: string
): Promise<RecentPaycheckDefaults | null> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'account_id, gross_amount, pension_own_pct, pension_employer_pct, other_deduction_amount, tax_rate_pct'
    )
    .eq('household_id', householdId)
    .eq('family_member_id', familyMemberId)
    .eq('income_role', 'primary')
    .eq('recurrence', 'once')
    .order('occurs_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ----------------------------------------------------------------------------
// Hovedindkomst-forecast - gennemsnit af de seneste N lønudbetalinger
// ----------------------------------------------------------------------------
// I stedet for at lade brugeren gætte "ca. så meget tjener jeg pr. md", lader
// vi dem registrere faktiske udbetalinger som 'once'-transaktioner med
// fuldt brutto/fradrag/pension/netto-breakdown. Når vi har 3+ logged
// paychecks beregner vi et glidende gennemsnit til at forudsige resten af
// året - og fanger dermed automatisk variansen i overtid, bonus og
// ferietillæg uden at brugeren behøver vedligeholde et manuelt skøn.
//
// status:
//   'insufficient' - færre end 3 udbetalinger registreret. Forecast kan
//     ikke beregnes; UI skal vise "log flere lønsedler"-CTA.
//   'ready' - mindst 3 udbetalinger; gennemsnit er pålideligt nok til
//     forecast.
export type PaycheckSample = {
  id: string;
  occurs_on: string;
  amount: number;       // netto / øre
  gross_amount: number | null;
};

export type PrimaryIncomeForecast =
  | {
      status: 'insufficient';
      paychecksUsed: number;
      paychecksNeeded: number;
      samples: PaycheckSample[];
    }
  | {
      status: 'ready';
      paychecksUsed: number;
      monthlyNet: number;
      monthlyGross: number | null; // null hvis brutto ikke er udfyldt på alle samples
      samples: PaycheckSample[];
    };

const PAYCHECKS_REQUIRED = 3;

export async function getPrimaryIncomeForecast(
  familyMemberId: string
): Promise<PrimaryIncomeForecast> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, occurs_on, amount, gross_amount')
    .eq('household_id', householdId)
    .eq('family_member_id', familyMemberId)
    .eq('income_role', 'primary')
    .eq('recurrence', 'once')
    .order('occurs_on', { ascending: false })
    .limit(PAYCHECKS_REQUIRED)
    .returns<PaycheckSample[]>();
  if (error) throw error;

  const samples = data ?? [];
  if (samples.length < PAYCHECKS_REQUIRED) {
    return {
      status: 'insufficient',
      paychecksUsed: samples.length,
      paychecksNeeded: PAYCHECKS_REQUIRED,
      samples,
    };
  }

  const monthlyNet = Math.round(
    samples.reduce((s, p) => s + p.amount, 0) / samples.length
  );

  // Brutto-gennemsnit kun hvis ALLE samples har gross udfyldt - ellers
  // bliver gennemsnittet skævt af de manglende felter (regnet som 0).
  const allHaveGross = samples.every((p) => p.gross_amount != null);
  const monthlyGross = allHaveGross
    ? Math.round(
        samples.reduce((s, p) => s + (p.gross_amount ?? 0), 0) / samples.length
      )
    : null;

  return {
    status: 'ready',
    paychecksUsed: samples.length,
    monthlyNet,
    monthlyGross,
    samples,
  };
}
