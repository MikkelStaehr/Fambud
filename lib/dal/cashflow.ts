// Cashflow-graph - pengestrømmen mellem konti.
//
// Detaljeret cashflow-data til Sankey-graf-visualiseringen på dashboardet.
// Forskellen fra getAccountFlows() (i accounts.ts) er at vi separerer
// income/expense (eksterne kanter til/fra synthetic "Indtægter"/"Udgifter"-
// noder) fra transfers (kanter mellem konti). Den aggregerede in/out i
// flows gjorde det umuligt at tegne grafen korrekt - hvis vi blot tegnede
// in→Udgifter ville en transfer til en opsparingskonto fejlagtigt blive
// vist som en udgift.
//
// Andre cashflow-aggregater (dashboard-totals, advisor-context, kategori-
// fordeling, top-N, upcoming events) er splittet ud i deres egne moduler:
//   - dashboard.ts          - getDashboardData, getHouseholdFinancialSummary
//   - advisor.ts            - getAdvisorContext + per-bidragyder-splits
//   - expenses-by-category.ts - getMonthlyExpensesByCategory/Group/Top
//   - upcoming-events.ts    - getUpcomingEvents
// Alle importerer getCashflowGraph herfra hvis de skal bruge cashflow-data.

import { cache } from 'react';
import type { RecurrenceFreq } from '@/lib/database.types';
import { effectiveAmount, monthlyEquivalent } from '@/lib/format';
import { getHouseholdContext } from './auth';

export type AccountCashflowDetail = {
  income: number;        // monthlyEquivalent af kategori=income transaktioner
  expense: number;       // monthlyEquivalent af kategori=expense transaktioner
  transfersIn: number;   // monthlyEquivalent af indgående overførsler
  transfersOut: number;  // monthlyEquivalent af udgående overførsler
};

export type CashflowEdge = {
  from: string;          // account id (eller 'income' synthetic)
  to: string;            // account id (eller 'expense' synthetic)
  monthly: number;
  kind: 'income' | 'expense' | 'transfer';
};

export type CashflowGraphData = {
  perAccount: Map<string, AccountCashflowDetail>;
  edges: CashflowEdge[];
};

// cache() memoizer pr. React-request, så getDashboardData og dashboard-page
// der begge læser cashflow-data ikke laver dobbelt round-trip mod DB'en.
export const getCashflowGraph = cache(async (): Promise<CashflowGraphData> => {
  const { supabase, householdId } = await getHouseholdContext();

  // Vi henter tre datasæt parallelt:
  //   1. Recurring (ikke-once) transaktioner - almindelig income/expense
  //      hvor monthlyEquivalent giver mening
  //   2. Recurring transfers - transfers mellem konti (også monthlyEquivalent)
  //   3. Primary-once paychecks - individuelle lønudbetalinger som er gemt
  //      med recurrence='once'. De har ikke en "monthly recurrence" men vi
  //      bruger gennemsnit af de seneste 3 som forecast pr. konto, så
  //      lønindkomst dukker op i grafen lige som den tidligere
  //      "Månedsløn"-recurring-transaktion gjorde.
  const [txnsRes, transfersRes, paychecksRes] = await Promise.all([
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
    supabase
      .from('transactions')
      .select('account_id, family_member_id, amount, occurs_on')
      .eq('household_id', householdId)
      .eq('income_role', 'primary')
      .eq('recurrence', 'once')
      .order('occurs_on', { ascending: false })
      .returns<{
        account_id: string;
        family_member_id: string | null;
        amount: number;
        occurs_on: string;
      }[]>(),
  ]);

  if (txnsRes.error) throw txnsRes.error;
  if (transfersRes.error) throw transfersRes.error;
  if (paychecksRes.error) throw paychecksRes.error;

  const perAccount = new Map<string, AccountCashflowDetail>();
  const detailFor = (id: string) => {
    let d = perAccount.get(id);
    if (!d) {
      d = { income: 0, expense: 0, transfersIn: 0, transfersOut: 0 };
      perAccount.set(id, d);
    }
    return d;
  };

  // Aggregér income/expense pr. konto (kanten Indtægter→konto eller
  // konto→Udgifter er summen af alle transaktioner, ikke én pr. række).
  for (const t of txnsRes.data ?? []) {
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    const monthly = monthlyEquivalent(eff, t.recurrence);
    if (t.category?.kind === 'income') detailFor(t.account_id).income += monthly;
    else if (t.category?.kind === 'expense') detailFor(t.account_id).expense += monthly;
  }

  // Forecast fra primary-once paychecks: gruppér efter (account, member),
  // tag de seneste 3 og brug gennemsnit som månedlig income. Det matcher
  // PrimaryIncomeForecast-logikken i income.ts. Hvis der er færre end 3
  // paychecks, bruger vi gennemsnittet af det vi har - bedre end ingenting,
  // selvom forecastet er mindre præcist.
  const paycheckGroups = new Map<string, number[]>();
  for (const p of paychecksRes.data ?? []) {
    const key = `${p.account_id}|${p.family_member_id ?? ''}`;
    const arr = paycheckGroups.get(key) ?? [];
    if (arr.length < 3) arr.push(p.amount);
    paycheckGroups.set(key, arr);
  }
  for (const [key, amounts] of paycheckGroups) {
    if (amounts.length === 0) continue;
    const accountId = key.split('|')[0];
    const avg = Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
    detailFor(accountId).income += avg;
  }

  // Transfers tæller mod hver kontos in/out aggregat (perAccount), MEN vi
  // beholder dem som separate kanter i `edges` så grafen viser flere
  // strømme der peger på samme destination som adskilte bånd.
  //
  // Dette er bevidst forskelligt fra den tidligere adfærd hvor (from, to)
  // blev summeret. Når brugeren har én Bufferkonto der modtager BÅDE en
  // buffer-overførsel og en forudsigelige-uforudsete-overførsel, skal de
  // to pengestrømme stå som to separate bånd i Sankey'en - ikke som én
  // klumpet linje.
  const transferEdges: CashflowEdge[] = [];
  for (const tr of transfersRes.data ?? []) {
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    detailFor(tr.from_account_id).transfersOut += monthly;
    detailFor(tr.to_account_id).transfersIn += monthly;
    transferEdges.push({
      from: tr.from_account_id,
      to: tr.to_account_id,
      monthly,
      kind: 'transfer',
    });
  }

  // Byg kant-listen. Synthetic node-ids: 'income' (kilden) og 'expense'
  // (slutter). De håndteres specielt i graf-komponenten.
  const edges: CashflowEdge[] = [];
  for (const [accountId, d] of perAccount) {
    if (d.income > 0) edges.push({ from: 'income', to: accountId, monthly: d.income, kind: 'income' });
    if (d.expense > 0) edges.push({ from: accountId, to: 'expense', monthly: d.expense, kind: 'expense' });
  }
  edges.push(...transferEdges);

  return { perAccount, edges };
});
