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
  nextOccurrenceAfter,
} from '@/lib/format';
import {
  CATEGORY_GROUP_COLOR,
  categoryGroupFor,
  type CategoryGroup,
} from '@/lib/categories';
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

  // Vi henter tre datasæt parallelt:
  //   1. Recurring (ikke-once) transaktioner — almindelig income/expense
  //      hvor monthlyEquivalent giver mening
  //   2. Recurring transfers — transfers mellem konti (også monthlyEquivalent)
  //   3. Primary-once paychecks — individuelle lønudbetalinger som er gemt
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
  // paychecks, bruger vi gennemsnittet af det vi har — bedre end ingenting,
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
  // to pengestrømme stå som to separate bånd i Sankey'en — ikke som én
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

// "Udgifter pr. gruppe" — samme data som getMonthlyExpensesByCategory, men
// rullet op til de tematiske kategori-grupper (Bolig & lån, Transport, Børn …)
// og opdelt på private vs. fælles konti. Splittet sker ved konto-ejerskab:
// `accounts.owner_name === 'Fælles'` → fælles, alt andet → privat.
//
// Returnerer begge scopes i ét kald så dashboard-tab'et kan toggle uden et
// nyt server-roundtrip.
export type CategoryGroupSummary = {
  group: CategoryGroup;
  color: string;
  monthly: number;
};

export type ExpenseGroupBuckets = {
  private: CategoryGroupSummary[];
  shared: CategoryGroupSummary[];
};

export async function getMonthlyExpensesByGroup(): Promise<ExpenseGroupBuckets> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'amount, recurrence, components_mode, account:accounts(owner_name), category:categories(name, kind), components:transaction_components(amount)'
    )
    .eq('household_id', householdId)
    .neq('recurrence', 'once')
    .returns<{
      amount: number;
      recurrence: RecurrenceFreq;
      components_mode: 'additive' | 'breakdown';
      account: { owner_name: string | null } | null;
      category: { name: string; kind: 'income' | 'expense' } | null;
      components: { amount: number }[];
    }[]>();
  if (error) throw error;

  const privateTotals = new Map<CategoryGroup, number>();
  const sharedTotals = new Map<CategoryGroup, number>();
  for (const t of data ?? []) {
    if (!t.category || t.category.kind !== 'expense') continue;
    const eff = effectiveAmount(t.amount, t.components ?? [], t.components_mode);
    const monthly = monthlyEquivalent(eff, t.recurrence);
    const group = categoryGroupFor(t.category.name);
    const isShared = t.account?.owner_name === 'Fælles';
    const bucket = isShared ? sharedTotals : privateTotals;
    bucket.set(group, (bucket.get(group) ?? 0) + monthly);
  }

  const toSorted = (m: Map<CategoryGroup, number>): CategoryGroupSummary[] =>
    Array.from(m.entries())
      .map(([group, monthly]) => ({
        group,
        color: CATEGORY_GROUP_COLOR[group],
        monthly,
      }))
      .sort((a, b) => b.monthly - a.monthly);

  return { private: toSorted(privateTotals), shared: toSorted(sharedTotals) };
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
// Næste 7 dages begivenheder — kommende regninger og overførsler
// ----------------------------------------------------------------------------
// Dashboard-modulet "Næste begivenheder" viser hvad der sker økonomisk i den
// nære fremtid. Vi beregner det forlæns:
//   - For recurring transaktioner: rul deres anchor-dato frem til næste
//     forekomst efter today via nextOccurrenceAfter() — hvis dato er
//     inden for vinduet, inkluderes posten
//   - For 'once'-transaktioner: inkluderes hvis deres occurs_on er i
//     fremtiden inden for vinduet (fx en planlagt enkelt-betaling)
// Income-paychecks med income_role='primary' inkluderes ikke — de er
// historiske registreringer, ikke fremtidige forekomster (vi kender kun
// gennemsnit, ikke næste konkrete dato).
//
// Hver event-tagges med scope ('private' eller 'shared') afhængig af om
// kilde-kontoens owner_name === 'Fælles'. Det matcher den samme privat/fælles-
// opdeling som CategoryGroupChart bruger og lader UI'et toggle uden ekstra
// roundtrip.
export type EventScope = 'private' | 'shared';

export type UpcomingEvent = {
  id: string;
  kind: 'expense' | 'transfer';
  scope: EventScope;
  date: string;          // ISO YYYY-MM-DD — den fremtidige forekomst
  description: string;
  amount: number;        // positivt øre, fortegnet håndteres af kind
  account: { id: string; name: string } | null;
  destination: { id: string; name: string } | null; // kun for transfers
  category: { name: string; color: string } | null;  // kun for expenses
};

export async function getUpcomingEvents(days: number = 7): Promise<UpcomingEvent[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const horizon = new Date(todayDateOnly);
  horizon.setDate(horizon.getDate() + days);

  const [txnsRes, transfersRes] = await Promise.all([
    supabase
      .from('transactions')
      .select(
        'id, account_id, amount, description, occurs_on, recurrence, account:accounts(id, name, owner_name), category:categories!inner(name, color, kind)'
      )
      .eq('household_id', householdId)
      .eq('category.kind', 'expense')
      .returns<{
        id: string;
        account_id: string;
        amount: number;
        description: string | null;
        occurs_on: string;
        recurrence: RecurrenceFreq;
        account: { id: string; name: string; owner_name: string | null } | null;
        category: { name: string; color: string; kind: 'expense' } | null;
      }[]>(),
    supabase
      .from('transfers')
      .select(
        'id, amount, description, occurs_on, recurrence, from_account:accounts!from_account_id(id, name, owner_name), to_account:accounts!to_account_id(id, name)'
      )
      .eq('household_id', householdId)
      .returns<{
        id: string;
        amount: number;
        description: string | null;
        occurs_on: string;
        recurrence: RecurrenceFreq;
        from_account: { id: string; name: string; owner_name: string | null } | null;
        to_account: { id: string; name: string } | null;
      }[]>(),
  ]);

  if (txnsRes.error) throw txnsRes.error;
  if (transfersRes.error) throw transfersRes.error;

  const events: UpcomingEvent[] = [];
  const horizonISO = horizon.toISOString().slice(0, 10);
  const todayISO = todayDateOnly.toISOString().slice(0, 10);
  const scopeFor = (ownerName: string | null | undefined): EventScope =>
    ownerName === 'Fælles' ? 'shared' : 'private';

  for (const t of txnsRes.data ?? []) {
    const nextDate =
      t.recurrence === 'once' ? t.occurs_on : nextOccurrenceAfter(t.occurs_on, t.recurrence, today);
    if (nextDate < todayISO || nextDate > horizonISO) continue;
    events.push({
      id: t.id,
      kind: 'expense',
      scope: scopeFor(t.account?.owner_name),
      date: nextDate,
      description: t.description ?? t.category?.name ?? 'Regning',
      amount: t.amount,
      account: t.account ? { id: t.account.id, name: t.account.name } : null,
      destination: null,
      category: t.category ? { name: t.category.name, color: t.category.color } : null,
    });
  }

  for (const tr of transfersRes.data ?? []) {
    const nextDate =
      tr.recurrence === 'once' ? tr.occurs_on : nextOccurrenceAfter(tr.occurs_on, tr.recurrence, today);
    if (nextDate < todayISO || nextDate > horizonISO) continue;
    events.push({
      id: tr.id,
      kind: 'transfer',
      scope: scopeFor(tr.from_account?.owner_name),
      date: nextDate,
      description: tr.description ?? `Overførsel til ${tr.to_account?.name ?? '?'}`,
      amount: tr.amount,
      account: tr.from_account
        ? { id: tr.from_account.id, name: tr.from_account.name }
        : null,
      destination: tr.to_account,
      category: null,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
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

