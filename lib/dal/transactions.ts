// Transactions — generic CRUD reads + helpers for the /poster og /budget
// sider. Income- og loan-specifikke queries hører til hhv. income.ts og
// loans.ts.

import type {
  Account,
  Category,
  RecurrenceFreq,
  Transaction,
} from '@/lib/database.types';
import { monthBounds } from '@/lib/format';
import { getHouseholdContext } from './auth';

// Joined-row shape used by the list view. We use Supabase's nested-select
// syntax and stamp the response type with .returns<>() since our hand-written
// Database type doesn't yet declare Relationships entries.
//
// owner_name er med fordi /poster har Fælles/Private-tabs der splitter på
// kontoens ejerskab (samme regel som dashboard og /budget).
export type TransactionWithRelations = Transaction & {
  account: Pick<Account, 'id' | 'name' | 'owner_name'> | null;
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
      '*, account:accounts(id, name, owner_name), category:categories(id, name, kind, color)'
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

// Onboarding-progress: hvilke fundamentale trin har brugeren udført siden
// wizard? Dashboard'et bruger flagene til at vise en checkliste indtil alt
// er på plads. Vi grupperer i én funktion for at undgå multiple roundtrips.
export type OnboardingProgress = {
  hasRecurringExpenses: boolean;
  hasRecurringTransfers: boolean;
  hasBufferAccount: boolean;
};

export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const { supabase, householdId } = await getHouseholdContext();

  const [txnRes, transferRes, accountRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, recurrence, category:categories(kind)')
      .eq('household_id', householdId)
      .neq('recurrence', 'once')
      .returns<
        { id: string; recurrence: string; category: { kind: string } | null }[]
      >(),
    supabase
      .from('transfers')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .neq('recurrence', 'once'),
    supabase
      .from('accounts')
      .select('id, savings_purposes')
      .eq('household_id', householdId)
      .eq('archived', false)
      .returns<{ id: string; savings_purposes: string[] | null }[]>(),
  ]);

  if (txnRes.error) throw txnRes.error;
  if (transferRes.error) throw transferRes.error;
  if (accountRes.error) throw accountRes.error;

  return {
    hasRecurringExpenses: (txnRes.data ?? []).some(
      (t) => t.category?.kind === 'expense'
    ),
    hasRecurringTransfers: (transferRes.count ?? 0) > 0,
    hasBufferAccount: (accountRes.data ?? []).some((a) =>
      a.savings_purposes?.includes('buffer')
    ),
  };
}
