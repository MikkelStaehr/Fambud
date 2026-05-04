// Accounts CRUD + flow-aggregation pr. konto. Domænet dækker både den
// almindelige konto-liste (/konti) og specialiserede views (/budget,
// /opsparinger). Lån (kind='credit') hører til loans.ts og er bevidst
// EKSKLUDERET fra alle helpers her - /laan har sin egen flow.

import type { Account, AccountKind, RecurrenceFreq } from '@/lib/database.types';
import { effectiveAmount, monthlyEquivalent } from '@/lib/format';
import { getHouseholdContext } from './auth';

export async function getAccounts(
  opts: { includeArchived?: boolean } = {}
): Promise<Account[]> {
  const { supabase, householdId } = await getHouseholdContext();
  let query = supabase.from('accounts').select('*').eq('household_id', householdId);
  if (!opts.includeArchived) query = query.eq('archived', false);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getAccountById(id: string): Promise<Account> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('household_id', householdId)
    .single();
  if (error) throw error;
  return data;
}

// Steady-state cashflow per account in monthly øre. "in" tæller penge der
// ankommer på kontoen (income-transaktioner + indgående overførsler) og
// "out" tæller penge der forlader kontoen (expense-transaktioner + udgående
// overførsler). Engangs-poster ('once') tælles ikke med - vi vil have det
// stabile billede, ikke en bestemt måneds tilfældigheder.
//
// Bruges af /konti til at erstatte den misvisende opening_balance-saldo med
// en flow-orienteret repr i tråd med appens cashflow-filosofi.
export type AccountFlow = { in: number; out: number };

export async function getAccountFlows(): Promise<Map<string, AccountFlow>> {
  const { supabase, householdId } = await getHouseholdContext();

  const [txnsRes, transfersRes] = await Promise.all([
    supabase
      .from('transactions')
      .select(
        'account_id, amount, recurrence, components_mode, category:categories(kind), components:transaction_components(amount)'
      )
      .eq('household_id', householdId)
      .neq('recurrence', 'once')
      .returns<{
        account_id: string;
        amount: number;
        recurrence: RecurrenceFreq;
        components_mode: 'additive' | 'breakdown';
        category: { kind: 'income' | 'expense' } | null;
        components: { amount: number }[];
      }[]>(),
    supabase
      .from('transfers')
      .select('from_account_id, to_account_id, amount, recurrence')
      .eq('household_id', householdId)
      .neq('recurrence', 'once'),
  ]);

  if (txnsRes.error) throw txnsRes.error;
  if (transfersRes.error) throw transfersRes.error;

  const flows = new Map<string, AccountFlow>();
  const bump = (id: string, key: 'in' | 'out', amount: number) => {
    const cur = flows.get(id) ?? { in: 0, out: 0 };
    cur[key] += amount;
    flows.set(id, cur);
  };

  for (const t of txnsRes.data ?? []) {
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    const monthly = monthlyEquivalent(eff, t.recurrence);
    if (t.category?.kind === 'income') bump(t.account_id, 'in', monthly);
    else if (t.category?.kind === 'expense') bump(t.account_id, 'out', monthly);
  }

  for (const tr of transfersRes.data ?? []) {
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    bump(tr.from_account_id, 'out', monthly);
    bump(tr.to_account_id, 'in', monthly);
  }

  return flows;
}

// ----------------------------------------------------------------------------
// Budget-kategorisering - hvilke kinds der hører i hver "bucket"
// ----------------------------------------------------------------------------
// Account kinds we surface i /budget. Excludes:
//   - 'household': har sin egen side (/husholdning) til daily-spend tracking
//   - 'savings'/'investment': vises som "Opsparinger & buffer"-sektion på
//     /budget - de modtager indskud, ikke udgifter
//   - 'credit': payments go TO, not FROM - håndteres på /laan
//   - 'cash': sjælden
// Brugere der alligevel vil registrere udgifter på en af de udelukkede
// kinds kan bruge /poster direkte.
export const BUDGET_ACCOUNT_KINDS: AccountKind[] = ['checking', 'budget', 'other'];

// Kinds vi viser i "Opsparinger & buffer"-sektionen - det er konti man
// IKKE bruger fra, men overfører TIL. Sektionen hjælper brugeren se hvilke
// konti der mangler en månedlig overførsel.
export const SAVINGS_ACCOUNT_KINDS: AccountKind[] = ['savings', 'investment'];

export type BudgetAccount = Pick<Account, 'id' | 'name' | 'owner_name' | 'kind'>;

export async function getBudgetAccounts(): Promise<BudgetAccount[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, owner_name, kind')
    .eq('household_id', householdId)
    .eq('archived', false)
    .in('kind', BUDGET_ACCOUNT_KINDS)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Opsparings/investerings-konti med deres månedlige indkomne overførsel
// (sum af recurring transfers ind, normaliseret til kr/md). Bruges af
// "Opsparinger & buffer"-sektionen på /budget overview til at vise hvilke
// konti der mangler en månedlig overførsel.
export type SavingsAccountWithFlow = Account & {
  monthlyInflow: number;
  investment_type: Account['investment_type'];
};

export async function getSavingsAccountsWithFlow(): Promise<SavingsAccountWithFlow[]> {
  const { supabase, householdId } = await getHouseholdContext();

  const [accountsRes, transfersRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('household_id', householdId)
      .eq('archived', false)
      .in('kind', SAVINGS_ACCOUNT_KINDS)
      .order('created_at', { ascending: true }),
    supabase
      .from('transfers')
      .select('to_account_id, amount, recurrence')
      .eq('household_id', householdId)
      .neq('recurrence', 'once'),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (transfersRes.error) throw transfersRes.error;

  const inflowByAccount = new Map<string, number>();
  for (const tr of transfersRes.data ?? []) {
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    inflowByAccount.set(
      tr.to_account_id,
      (inflowByAccount.get(tr.to_account_id) ?? 0) + monthly
    );
  }

  return (accountsRes.data ?? []).map((a) => ({
    ...a,
    monthlyInflow: inflowByAccount.get(a.id) ?? 0,
  }));
}
