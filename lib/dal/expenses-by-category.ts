// Pr.-kategori og top-N — bruges af dashboardets charts.
//
// Alle tre helpers læser den samme transactions-baseline (recurring,
// kategori=expense, normaliseret til monthlyEquivalent) men aggregerer
// forskelligt: pr. kategori, pr. tematisk gruppe (privat vs. fælles)
// eller som top-N enkeltposter.

import type { RecurrenceFreq } from '@/lib/database.types';
import { effectiveAmount, monthlyEquivalent } from '@/lib/format';
import {
  CATEGORY_GROUP_COLOR,
  categoryGroupFor,
  type CategoryGroup,
} from '@/lib/categories';
import { getHouseholdContext } from './auth';

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
