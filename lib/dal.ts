// Data-access layer. Every Supabase query in the app should go through here
// so we get one consistent place to enforce auth, household-scoping, error
// handling and (later) caching.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  Account,
  AccountKind,
  Category,
  Household,
  HouseholdInvite,
  RecurrenceFreq,
  Transaction,
  Transfer,
} from '@/lib/database.types';
import { currentYearMonth, monthBounds, monthlyEquivalent } from '@/lib/format';
import { STANDARD_EXPENSE_CATEGORIES } from '@/lib/categories';

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function getHouseholdContext() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('family_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.household_id) {
    // The auth trigger should have created one; if it didn't, the user is in
    // a broken state and re-login won't help. Surface loudly.
    throw new Error('No household found for user. The on_auth_user_created trigger may not have fired.');
  }
  return { supabase, householdId: data.household_id, user };
}

// Wizard / onboarding helpers — used by the (app) layout to gate access and
// by the wizard pages to read user-specific state.

export async function getMyMembership() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('family_members')
    .select('household_id, role, setup_completed_at, joined_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return { supabase, user, membership: data };
}

export async function isSetupComplete(): Promise<boolean> {
  const { membership } = await getMyMembership();
  return membership?.setup_completed_at != null;
}

export type DashboardAccount = Pick<Account, 'id' | 'name' | 'owner_name' | 'kind'>;

export type DashboardData = {
  accounts: DashboardAccount[];
  monthlyTotals: { income: number; expense: number; net: number };
  yearMonth: string;
};

export type SettingsInvite = Pick<
  HouseholdInvite,
  'id' | 'code' | 'created_at' | 'expires_at'
>;

export type SettingsData = {
  household: Pick<Household, 'id' | 'name' | 'created_at'>;
  invites: SettingsInvite[];
  familyMembers: FamilyMemberRow[];
  currentUserId: string;
};

export async function getSettingsData(): Promise<SettingsData> {
  const { supabase, householdId, user } = await getHouseholdContext();

  const [householdRes, invitesRes, familyRes] = await Promise.all([
    supabase
      .from('households')
      .select('id, name, created_at')
      .eq('id', householdId)
      .single(),
    supabase
      .from('household_invites')
      .select('id, code, created_at, expires_at')
      .eq('household_id', householdId)
      .is('used_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('family_members')
      .select('id, name, birthdate, user_id, position, email, role, joined_at')
      .eq('household_id', householdId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (householdRes.error) throw householdRes.error;
  if (invitesRes.error) throw invitesRes.error;
  if (familyRes.error) throw familyRes.error;

  return {
    household: householdRes.data,
    invites: invitesRes.data ?? [],
    familyMembers: familyRes.data ?? [],
    currentUserId: user.id,
  };
}

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
      const componentsSum = (t.components ?? []).reduce((s, c) => s + c.amount, 0);
      const effective =
        t.components_mode === 'breakdown' ? t.amount : t.amount + componentsSum;
      if (t.category?.kind === 'income') acc.income += effective;
      else if (t.category?.kind === 'expense') acc.expense += effective;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );
  monthlyTotals.net = monthlyTotals.income - monthlyTotals.expense;

  return { accounts: accountsRes.data ?? [], monthlyTotals, yearMonth };
}

// ----------------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------------
export async function getAccounts(opts: { includeArchived?: boolean } = {}): Promise<Account[]> {
  const { supabase, householdId } = await getHouseholdContext();
  let query = supabase
    .from('accounts')
    .select('*')
    .eq('household_id', householdId);
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
// overførsler). Engangs-poster ('once') tælles ikke med — vi vil have det
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
    const componentsSum = (t.components ?? []).reduce((s, c) => s + c.amount, 0);
    // Effective amount honours components_mode — additive stacks tilkøb on
    // top, breakdown treats parent as the total. Identical to the dashboard
    // computation in getDashboardData().
    const effective =
      t.components_mode === 'breakdown' ? t.amount : t.amount + componentsSum;
    const monthly = monthlyEquivalent(effective, t.recurrence);
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

// Detaljeret cashflow-data til graf-visualiseringen på dashboard. Forskellen
// fra getAccountFlows() er at vi separerer income/expense (eksterne kanter
// til/fra synthetic "Indtægter"/"Udgifter"-noder) fra transfers (kanter
// mellem konti). Den aggregerede in/out i flows gjorde det umuligt at
// tegne grafen korrekt — hvis vi blot tegnede in→Udgifter ville en transfer
// til en opsparingskonto fejlagtigt blive vist som en udgift.
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
    const componentsSum = (t.components ?? []).reduce((s, c) => s + c.amount, 0);
    const effective =
      t.components_mode === 'breakdown' ? t.amount : t.amount + componentsSum;
    const monthly = monthlyEquivalent(effective, t.recurrence);
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
    const componentsSum = (t.components ?? []).reduce((s, c) => s + c.amount, 0);
    const effective =
      t.components_mode === 'breakdown' ? t.amount : t.amount + componentsSum;
    const monthly = monthlyEquivalent(effective, t.recurrence);
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
    const componentsSum = (t.components ?? []).reduce((s, c) => s + c.amount, 0);
    const effective =
      t.components_mode === 'breakdown' ? t.amount : t.amount + componentsSum;
    const monthly = monthlyEquivalent(effective, t.recurrence);
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
// Categories
// ----------------------------------------------------------------------------
export async function getCategories(opts: { includeArchived?: boolean } = {}): Promise<Category[]> {
  const { supabase, householdId } = await getHouseholdContext();
  let query = supabase
    .from('categories')
    .select('*')
    .eq('household_id', householdId);
  if (!opts.includeArchived) query = query.eq('archived', false);
  const { data, error } = await query.order('kind').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getCategoryById(id: string): Promise<Category> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .eq('household_id', householdId)
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Transactions
// ----------------------------------------------------------------------------
// Joined-row shape used by the list view. We use Supabase's nested-select
// syntax and stamp the response type with .returns<>() since our hand-written
// Database type doesn't yet declare Relationships entries.
export type TransactionWithRelations = Transaction & {
  account: Pick<Account, 'id' | 'name'> | null;
  category: Pick<Category, 'id' | 'name' | 'kind' | 'color'> | null;
};

export async function getTransactionsForMonth(
  yearMonth: string
): Promise<TransactionWithRelations[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { start, end } = monthBounds(yearMonth);

  const { data, error } = await supabase
    .from('transactions')
    .select(
      '*, account:accounts(id, name), category:categories(id, name, kind, color)'
    )
    .eq('household_id', householdId)
    .gte('occurs_on', start)
    .lte('occurs_on', end)
    .order('occurs_on', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransactionWithRelations[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getTransactionById(id: string): Promise<Transaction> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('household_id', householdId)
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Transfers
// ----------------------------------------------------------------------------
export type TransferWithRelations = Transfer & {
  from_account: Pick<Account, 'id' | 'name'> | null;
  to_account: Pick<Account, 'id' | 'name'> | null;
};

export async function getTransfersForMonth(
  yearMonth: string
): Promise<TransferWithRelations[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { start, end } = monthBounds(yearMonth);

  // Two FKs from transfers→accounts, so we disambiguate by column name. This
  // is more robust than the constraint-name form because we don't depend on
  // Postgres's auto-generated constraint naming (transfers_from_account_id_fkey).
  const { data, error } = await supabase
    .from('transfers')
    .select(
      '*, from_account:accounts!from_account_id(id, name), to_account:accounts!to_account_id(id, name)'
    )
    .eq('household_id', householdId)
    .gte('occurs_on', start)
    .lte('occurs_on', end)
    .order('occurs_on', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransferWithRelations[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getTransferById(id: string): Promise<Transfer> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('id', id)
    .eq('household_id', householdId)
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Budget wizard
// ----------------------------------------------------------------------------
// Account kinds we surface in /budget. Excludes 'savings' / 'investment' (no
// expenses typically — depoter modtager indskud, ikke udgifter), 'credit'
// (payments go TO, not FROM), and 'cash' (rare). Users who do want to add
// expenses on those accounts can still use /poster.
export const BUDGET_ACCOUNT_KINDS: AccountKind[] = [
  'checking',
  'budget',
  'household',
  'other',
];

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

// Race-safe seeding of the standard categories. Uses UPSERT with
// ignoreDuplicates so concurrent /budget loads (Next.js prefetch, multiple
// tabs, RSC streaming) can't end up creating duplicate rows. Relies on the
// (household_id, name, kind) unique constraint added in migration 0008.
//
// ignoreDuplicates means: if the row already exists, do nothing — including
// not overwriting any colour the user may have customised in /indstillinger.
export async function ensureStandardExpenseCategories() {
  const { supabase, householdId } = await getHouseholdContext();

  const rows = STANDARD_EXPENSE_CATEGORIES.map((c) => ({
    household_id: householdId,
    name: c.name,
    kind: 'expense' as const,
    color: c.color,
  }));

  const { error } = await supabase.from('categories').upsert(rows, {
    onConflict: 'household_id,name,kind',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export type ExpenseComponent = {
  id: string;
  label: string;
  amount: number;
  position: number;
  family_member_id: string | null;
  family_member: { id: string; name: string } | null;
};

export type RecurringExpenseRow = {
  id: string;
  amount: number;
  description: string | null;
  occurs_on: string;
  recurrence: RecurrenceFreq;
  category: { id: string; name: string; color: string; kind: string } | null;
  components: ExpenseComponent[];
  group_label: string | null;
  components_mode: 'additive' | 'breakdown';
  family_member_id: string | null;
  family_member: { id: string; name: string } | null;
};

// Recurring (= not 'once') expense-categorised transactions on a single
// account, joined with their components for inline breakdown rendering.
// Filtered to expense-kind categories post-fetch because we can't query
// directly on a joined column's value.
export async function getRecurringExpensesForAccount(
  accountId: string
): Promise<RecurringExpenseRow[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, amount, description, occurs_on, recurrence, group_label, components_mode, family_member_id, family_member:family_members(id, name), category:categories(id, name, color, kind), components:transaction_components(id, label, amount, position, family_member_id, family_member:family_members(id, name))'
    )
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .neq('recurrence', 'once')
    .order('occurs_on', { ascending: true })
    .returns<RecurringExpenseRow[]>();
  if (error) throw error;

  // Sort each row's components by position so they render in insertion order.
  return (data ?? [])
    .filter((t) => t.category?.kind === 'expense')
    .map((t) => ({
      ...t,
      components: [...(t.components ?? [])].sort((a, b) => a.position - b.position),
    }));
}

// ----------------------------------------------------------------------------
// Loans — credit accounts with the loan-metadata fields populated
// ----------------------------------------------------------------------------
// /laan surfaces every kind='credit' account regardless of whether the
// loan-specific fields (loan_type, original_principal, term_months, lender,
// monthly_payment) are set, since the wizard creates them empty and the
// /laan edit form is where the user fills them in.
export type LoanRow = Account;

export async function getLoans(): Promise<LoanRow[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('household_id', householdId)
    .eq('kind', 'credit')
    .eq('archived', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getLoanById(id: string): Promise<LoanRow> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('household_id', householdId)
    .eq('kind', 'credit')
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Income — convenience wrappers around income-category transactions
// ----------------------------------------------------------------------------
// We treat any transaction whose category.kind = 'income' as income. The
// /indkomst page filters and decorates these with family-member tags and
// optional gross/pension fields.
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
> & {
  account: Pick<Account, 'id' | 'name'> | null;
  family_member: { id: string; name: string } | null;
};

export async function getIncomeTransactions(): Promise<IncomeRow[]> {
  const { supabase, householdId } = await getHouseholdContext();
  // !inner makes this filter via a join — PostgREST only allows filtering
  // through joined columns when the join is inner.
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `id, account_id, category_id, amount, description, occurs_on,
       recurrence, recurrence_until, family_member_id,
       gross_amount, pension_own_pct, pension_employer_pct,
       account:accounts(id, name),
       family_member:family_members(id, name),
       category:categories!inner(kind)`
    )
    .eq('household_id', householdId)
    .eq('category.kind', 'income')
    .order('occurs_on', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<(IncomeRow & { category: { kind: 'income' } })[]>();

  if (error) throw error;
  // Strip the join-only `category` field — callers don't need it.
  return (data ?? []).map(({ category: _c, ...rest }) => rest);
}

export async function getIncomeById(id: string): Promise<IncomeRow> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `id, account_id, category_id, amount, description, occurs_on,
       recurrence, recurrence_until, family_member_id,
       gross_amount, pension_own_pct, pension_employer_pct,
       account:accounts(id, name),
       family_member:family_members(id, name)`
    )
    .eq('id', id)
    .eq('household_id', householdId)
    .single<IncomeRow>();
  if (error) throw error;
  return data;
}

// Family members — anyone in the household. user_id NOT NULL means they have
// a login; email NOT NULL with user_id NULL means they're pre-approved and
// will be auto-claimed when they sign up with that email.
export type FamilyMemberRow = {
  id: string;
  name: string;
  birthdate: string | null;
  user_id: string | null;
  position: number;
  email: string | null;
  role: string | null;
  joined_at: string | null;
};

export async function getFamilyMembers(): Promise<FamilyMemberRow[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('family_members')
    .select('id, name, birthdate, user_id, position, email, role, joined_at')
    .eq('household_id', householdId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Distinct group_label values for the household — used to populate the
// HTML datalist so users see existing groups (Popermo, TopDanmark, …) when
// adding/editing an expense, reducing typo-driven group splits.
export async function getDistinctExpenseGroups(): Promise<string[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select('group_label')
    .eq('household_id', householdId)
    .not('group_label', 'is', null);
  if (error) throw error;
  const seen = new Set<string>();
  for (const r of data ?? []) {
    if (r.group_label) seen.add(r.group_label);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'da'));
}

// Used by the dashboard CTA — we want it to disappear only once the user has
// actually set up at least one recurring EXPENSE. The wizard's auto-created
// monthly income (Månedsløn) shouldn't count, otherwise the CTA hides
// immediately after onboarding.
export async function hasAnyRecurringExpenses(): Promise<boolean> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, category:categories(kind)')
    .eq('household_id', householdId)
    .neq('recurrence', 'once')
    .returns<{ id: string; category: { kind: string } | null }[]>();
  if (error) throw error;
  return (data ?? []).some((t) => t.category?.kind === 'expense');
}
