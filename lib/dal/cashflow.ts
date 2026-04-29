// Cashflow-aggregation. Alle tunge "summer over hele husstandens
// transaktioner"-helpers bor her — dashboardets month-totals, pengestrøm-
// graf, kategori-fordeling, top-N udgifter, og advisorens kontekst.
//
// Det er bevidst at det meste her er steady-state (monthlyEquivalent over
// recurring rows) i stedet for "denne måneds bogførte poster" — appens
// filosofi er forecast/cashflow, ikke bogholderi.

import type { Account, RecurrenceFreq } from '@/lib/database.types';
import {
  currentYearMonth,
  effectiveAmount,
  monthBounds,
  monthlyEquivalent,
} from '@/lib/format';
import { getHouseholdContext } from './auth';

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
  const { supabase, householdId } = await getHouseholdContext();
  const yearMonth = currentYearMonth();
  const { start, end } = monthBounds(yearMonth);

  // Two parallel reads. We don't fetch opening_balance — the dashboard is
  // about flow now, not beholdning. Recurring transactions are visible only
  // on their stored occurs_on; future projections are the forecast engine's
  // job (later milestone).
  const [accountsRes, txnsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, owner_name, kind')
      .eq('household_id', householdId)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select(
        'amount, components_mode, category:categories(kind), components:transaction_components(amount)'
      )
      .eq('household_id', householdId)
      .gte('occurs_on', start)
      .lte('occurs_on', end)
      .returns<{
        amount: number;
        components_mode: 'additive' | 'breakdown';
        category: { kind: 'income' | 'expense' } | null;
        components: { amount: number }[];
      }[]>(),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (txnsRes.error) throw txnsRes.error;

  // Effective amount honours components_mode — additive stacks tilkøb on top,
  // breakdown treats parent as the total and components as informational.
  const monthlyTotals = (txnsRes.data ?? []).reduce(
    (acc, t) => {
      const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
      if (t.category?.kind === 'income') acc.income += eff;
      else if (t.category?.kind === 'expense') acc.expense += eff;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );
  monthlyTotals.net = monthlyTotals.income - monthlyTotals.expense;

  return { accounts: accountsRes.data ?? [], monthlyTotals, yearMonth };
}

// ----------------------------------------------------------------------------
// Cashflow-graph — pengestrømmen mellem konti
// ----------------------------------------------------------------------------
// Detaljeret cashflow-data til graf-visualiseringen på dashboard. Forskellen
// fra getAccountFlows() (i accounts.ts) er at vi separerer income/expense
// (eksterne kanter til/fra synthetic "Indtægter"/"Udgifter"-noder) fra
// transfers (kanter mellem konti). Den aggregerede in/out i flows gjorde det
// umuligt at tegne grafen korrekt — hvis vi blot tegnede in→Udgifter ville
// en transfer til en opsparingskonto fejlagtigt blive vist som en udgift.
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

export async function getCashflowGraph(): Promise<CashflowGraphData> {
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

  // Aggregér transfers pr. (from, to) par så samme rute ikke giver flere
  // kanter på grafen.
  const transferKey = (from: string, to: string) => `${from}→${to}`;
  const transferAggregate = new Map<string, { from: string; to: string; monthly: number }>();
  for (const tr of transfersRes.data ?? []) {
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    detailFor(tr.from_account_id).transfersOut += monthly;
    detailFor(tr.to_account_id).transfersIn += monthly;
    const k = transferKey(tr.from_account_id, tr.to_account_id);
    const prev = transferAggregate.get(k);
    if (prev) prev.monthly += monthly;
    else transferAggregate.set(k, { from: tr.from_account_id, to: tr.to_account_id, monthly });
  }

  // Byg kant-listen. Synthetic node-ids: 'income' (kilden) og 'expense'
  // (slutter). De håndteres specielt i graf-komponenten.
  const edges: CashflowEdge[] = [];
  for (const [accountId, d] of perAccount) {
    if (d.income > 0) edges.push({ from: 'income', to: accountId, monthly: d.income, kind: 'income' });
    if (d.expense > 0) edges.push({ from: accountId, to: 'expense', monthly: d.expense, kind: 'expense' });
  }
  for (const tr of transferAggregate.values()) {
    edges.push({ from: tr.from, to: tr.to, monthly: tr.monthly, kind: 'transfer' });
  }

  return { perAccount, edges };
}

// ----------------------------------------------------------------------------
// Advisor-context — udvider getCashflowGraph med data CashflowAdvisor skal
// bruge for at lave per-bruger-forslag på fælles-konti
// ----------------------------------------------------------------------------
// Når en fælles-konto er underdækket, skal forslaget kun adressere DEN
// indloggede brugers manglende andel — ikke det fulde underskud. Det
// kræver at vi ved:
//   1. Hvem har bidraget til kontoen (transfers grupperet efter
//      from_account.created_by)
//   2. Hvor mange skal forventes at bidrage (logged-in + pre-godkendte
//      family_members)
//   3. Hvilke pre-godkendte er der så vi kan vise "Louise mangler signup"-
//      banneret
//
// Vi samler alt i én helper så CashflowAdvisor kun har én DAL-call.
export type PendingMember = { id: string; name: string; email: string };

export type AdvisorContext = {
  // Allerede i CashflowGraphData, gentaget her for et samlet svar.
  perAccount: Map<string, AccountCashflowDetail>;
  // Pr. (from_account, to_account) summen pr. bruger der har skabt
  // from_account. Bruges til at finde "hvor meget har Mikkel bidraget til
  // fælles-Budgetkontoen?" via accounts-creator-mapping.
  transfersByCreator: {
    fromAccountId: string;
    toAccountId: string;
    creatorUserId: string | null;
    monthly: number;
  }[];
  // Antal personer der forventes at bidrage til fælles-udgifter. Tæller
  // både logged-in (user_id != null) og pre-godkendte (email != null,
  // user_id == null) family_members. Min. 1.
  numContributors: number;
  pendingMembers: PendingMember[];
  currentUserId: string;
};

export async function getAdvisorContext(): Promise<AdvisorContext> {
  const { supabase, householdId, user } = await getHouseholdContext();

  const [transfersRes, accountsRes, familyRes, graphData] = await Promise.all([
    supabase
      .from('transfers')
      .select('from_account_id, to_account_id, amount, recurrence')
      .eq('household_id', householdId)
      .neq('recurrence', 'once'),
    // Vi har brug for created_by pr. konto for at vide hvem der "ejer"
    // en transfer's kilde. Henter slim version (ikke alle felter).
    supabase
      .from('accounts')
      .select('id, created_by')
      .eq('household_id', householdId),
    supabase
      .from('family_members')
      .select('id, name, email, user_id')
      .eq('household_id', householdId),
    getCashflowGraph(),
  ]);

  if (transfersRes.error) throw transfersRes.error;
  if (accountsRes.error) throw accountsRes.error;
  if (familyRes.error) throw familyRes.error;

  // Map account_id → created_by user id
  const creatorByAccount = new Map<string, string | null>();
  for (const a of accountsRes.data ?? []) {
    creatorByAccount.set(a.id, a.created_by);
  }

  // Aggregér transfers pr. (from, to, creator)-tripel så samme person der
  // har lavet flere transfers fra forskellige af deres konti tæller samlet.
  type Key = string;
  const aggregate = new Map<Key, AdvisorContext['transfersByCreator'][0]>();
  for (const tr of transfersRes.data ?? []) {
    const creator = creatorByAccount.get(tr.from_account_id) ?? null;
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    const key = `${tr.from_account_id}→${tr.to_account_id}@${creator ?? 'null'}`;
    const prev = aggregate.get(key);
    if (prev) prev.monthly += monthly;
    else aggregate.set(key, {
      fromAccountId: tr.from_account_id,
      toAccountId: tr.to_account_id,
      creatorUserId: creator,
      monthly,
    });
  }

  // Antal forventede bidragsydere: alle family_members der enten ER
  // logget-ind eller er pre-godkendt via email. Børn (begge null) tælles
  // ikke med — de bidrager ikke økonomisk.
  const contributors = (familyRes.data ?? []).filter(
    (fm) => fm.user_id != null || fm.email != null
  );
  const pendingMembers: PendingMember[] = (familyRes.data ?? [])
    .filter((fm) => fm.user_id == null && fm.email != null)
    .map((fm) => ({ id: fm.id, name: fm.name, email: fm.email as string }));

  return {
    perAccount: graphData.perAccount,
    transfersByCreator: Array.from(aggregate.values()),
    numContributors: Math.max(1, contributors.length),
    pendingMembers,
    currentUserId: user.id,
  };
}

// ----------------------------------------------------------------------------
// Pr.-kategori og top-N — bruges af dashboardets charts
// ----------------------------------------------------------------------------
// "Hvor går pengene hen?" — pr.-kategori-fordeling af alle faste udgifter
// (recurring), normaliseret til månedligt beløb. Bruges af dashboardets
// kategori-graf og er bevidst steady-state (monthlyEquivalent) i stedet for
// "denne måneds bogførte poster" så folk kan se den gennemsnitlige
// kategori-vægt uanset om en post er ugentlig, kvartalvis eller årlig.
export type CategoryExpenseSummary = {
  category: { id: string; name: string; color: string };
  monthly: number;
};

export async function getMonthlyExpensesByCategory(): Promise<CategoryExpenseSummary[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'amount, recurrence, components_mode, category:categories(id, name, color, kind), components:transaction_components(amount)'
    )
    .eq('household_id', householdId)
    .neq('recurrence', 'once')
    .returns<{
      amount: number;
      recurrence: RecurrenceFreq;
      components_mode: 'additive' | 'breakdown';
      category: { id: string; name: string; color: string; kind: 'income' | 'expense' } | null;
      components: { amount: number }[];
    }[]>();
  if (error) throw error;

  const map = new Map<string, CategoryExpenseSummary>();
  for (const t of data ?? []) {
    if (!t.category || t.category.kind !== 'expense') continue;
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    const monthly = monthlyEquivalent(eff, t.recurrence);
    const existing = map.get(t.category.id);
    if (existing) existing.monthly += monthly;
    else
      map.set(t.category.id, {
        category: { id: t.category.id, name: t.category.name, color: t.category.color },
        monthly,
      });
  }

  return Array.from(map.values()).sort((a, b) => b.monthly - a.monthly);
}

// Top-N største enkelt-udgifter normaliseret til månedlig sats. Praktisk på
// dashboardet til "hvor er de store sten?" — typisk husleje, lån, afdragene.
export type TopExpenseRow = {
  id: string;
  description: string | null;
  category: { name: string; color: string } | null;
  monthly: number;
  recurrence: RecurrenceFreq;
};

export async function getTopRecurringExpenses(limit = 5): Promise<TopExpenseRow[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, description, amount, recurrence, components_mode, category:categories(name, color, kind), components:transaction_components(amount)'
    )
    .eq('household_id', householdId)
    .neq('recurrence', 'once')
    .returns<{
      id: string;
      description: string | null;
      amount: number;
      recurrence: RecurrenceFreq;
      components_mode: 'additive' | 'breakdown';
      category: { name: string; color: string; kind: 'income' | 'expense' } | null;
      components: { amount: number }[];
    }[]>();
  if (error) throw error;

  const rows: TopExpenseRow[] = [];
  for (const t of data ?? []) {
    if (t.category?.kind !== 'expense') continue;
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    const monthly = monthlyEquivalent(eff, t.recurrence);
    rows.push({
      id: t.id,
      description: t.description,
      category: t.category ? { name: t.category.name, color: t.category.color } : null,
      monthly,
      recurrence: t.recurrence,
    });
  }
  rows.sort((a, b) => b.monthly - a.monthly);
  return rows.slice(0, limit);
}

// ----------------------------------------------------------------------------
// Husstandens samlede økonomiske billede — bruges til at beregne anbefalede
// målbeløb (fx "buffer = 3 mdr af faste udgifter", "forudsigelige uforudsete
// = 15% af nettoindkomst")
// ----------------------------------------------------------------------------
export type HouseholdFinancialSummary = {
  // Sum af monthlyEquivalent for alle recurring income-transactions i husstanden.
  // Det er hvad faktisk lander på konti — nettoløn, ikke bruttoløn.
  monthlyNetIncome: number;
  // Sum af monthlyEquivalent for alle recurring expense-transactions, inkl.
  // effective amount (additive components stack på top af parent).
  monthlyFixedExpenses: number;
};

export async function getHouseholdFinancialSummary(): Promise<HouseholdFinancialSummary> {
  const { supabase, householdId } = await getHouseholdContext();

  const { data, error } = await supabase
    .from('transactions')
    .select(
      'amount, recurrence, components_mode, category:categories(kind), components:transaction_components(amount)'
    )
    .eq('household_id', householdId)
    .neq('recurrence', 'once')
    .returns<{
      amount: number;
      recurrence: RecurrenceFreq;
      components_mode: 'additive' | 'breakdown';
      category: { kind: 'income' | 'expense' } | null;
      components: { amount: number }[];
    }[]>();

  if (error) throw error;

  let monthlyNetIncome = 0;
  let monthlyFixedExpenses = 0;
  for (const t of data ?? []) {
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    const monthly = monthlyEquivalent(eff, t.recurrence);
    if (t.category?.kind === 'income') monthlyNetIncome += monthly;
    else if (t.category?.kind === 'expense') monthlyFixedExpenses += monthly;
  }

  return { monthlyNetIncome, monthlyFixedExpenses };
}

