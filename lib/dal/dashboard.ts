// Dashboard- og husstands-totals: tynde aggregeringer på toppen af
// getCashflowGraph. Begge funktioner er bevidst forecast-aware
// (monthlyEquivalent + 'once' paycheck-snit) frem for "denne måneds
// faktiske bogførsel" - appens hele filosofi er steady-state cashflow.

import type { Account, RecurrenceFreq } from '@/lib/database.types';
import {
  currentYearMonth,
  effectiveAmount,
  monthlyEquivalent,
} from '@/lib/format';
import {
  getPerspective,
  privateAccountFilter,
  getVisibleAccountIds,
} from './auth';
import { getCashflowGraph } from './cashflow';

// ----------------------------------------------------------------------------
// Dashboard-data: nuværende måneds totals + slim konto-liste
// ----------------------------------------------------------------------------
export type DashboardAccount = Pick<Account, 'id' | 'name' | 'owner_name' | 'kind'>;

export type DashboardData = {
  accounts: DashboardAccount[];
  monthlyTotals: { income: number; expense: number; net: number };
  yearMonth: string;
};

export async function getDashboardData(): Promise<DashboardData> {
  const p = await getPerspective();
  const yearMonth = currentYearMonth();

  // Slim konto-liste til dashboardet. Vi læser kun navne/typer - ikke
  // opening_balance, fordi dashboardet handler om flow, ikke beholdning.
  let accountsQ = p.supabase
    .from('accounts')
    .select('id, name, owner_name, kind')
    .eq('household_id', p.householdId)
    .eq('archived', false);
  accountsQ = accountsQ.or(privateAccountFilter(p));
  const { data: accounts, error: accErr } = await accountsQ
    .order('created_at', { ascending: true });
  if (accErr) throw accErr;

  // monthlyTotals udregnes fra cashflow-grafens forecast-aware aggregering
  // i stedet for at filtrere transaktioner på "denne kalendermåned". Det
  // betyder at:
  //   - 'monthly'-recurring expenses bidrager altid med deres beløb,
  //     uanset hvilken dato occurs_on peger på
  //   - 'once'-paychecks (income_role='primary') bidrager via avg-af-de-3-
  //     seneste, så HeroStatus matcher hvad cashflow-grafen viser
  // Tidligere logik filtrerede på occurs_on i nuværende måned, hvilket
  // gjorde at dashboardet sagde "0 indkomst" hvis brugeren havde paychecks
  // i tidligere måneder men endnu ingen i nuværende.
  const graph = await getCashflowGraph();
  let income = 0;
  let expense = 0;
  for (const detail of graph.perAccount.values()) {
    income += detail.income;
    expense += detail.expense;
  }
  const monthlyTotals = { income, expense, net: income - expense };

  return { accounts: accounts ?? [], monthlyTotals, yearMonth };
}

// ----------------------------------------------------------------------------
// Husstandens samlede faste udgifter - bruges til at beregne anbefalede
// målbeløb (fx "buffer = 3 mdr af faste udgifter").
// ----------------------------------------------------------------------------
export type HouseholdFinancialSummary = {
  // Sum af monthlyEquivalent for alle recurring expense-transactions, inkl.
  // effective amount (additive components stack på top af parent).
  monthlyFixedExpenses: number;
};

// BEMÆRK: Vi udstiller bevidst IKKE en "monthlyNetIncome" her. En sum af
// recurring income ville SPRINGE løn over (lønsedler er recurrence='once'
// primary-paychecks), så tallet ville undertælle indkomsten groft. Skal du
// bruge husstandens indkomst: brug getCashflowGraph() og summér
// perAccount.income - den inkluderer løn-forecastet (se /rapport og
// getDashboardData).
export async function getHouseholdFinancialSummary(): Promise<HouseholdFinancialSummary> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  if (visibleAccountIds && visibleAccountIds.length === 0) {
    return { monthlyFixedExpenses: 0 };
  }

  let q = p.supabase
    .from('transactions')
    .select(
      'amount, recurrence, components_mode, category:categories(kind), components:transaction_components(amount)'
    )
    .eq('household_id', p.householdId)
    .neq('recurrence', 'once');
  if (visibleAccountIds) q = q.in('account_id', visibleAccountIds);

  const { data, error } = await q.returns<{
    amount: number;
    recurrence: RecurrenceFreq;
    components_mode: 'additive' | 'breakdown';
    category: { kind: 'income' | 'expense' } | null;
    components: { amount: number }[];
  }[]>();

  if (error) throw error;

  let monthlyFixedExpenses = 0;
  for (const t of data ?? []) {
    if (t.category?.kind !== 'expense') continue;
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    monthlyFixedExpenses += monthlyEquivalent(eff, t.recurrence);
  }

  return { monthlyFixedExpenses };
}
