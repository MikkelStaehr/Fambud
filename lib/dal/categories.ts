// Categories - income/expense-tags på transactions. Husstanden har sit eget
// sæt; den unikke (household_id, name, kind) constraint fra migration 0008
// tillader en race-safe upsert af standard-kategorierne via on-conflict.

import type { Category } from '@/lib/database.types';
import { STANDARD_EXPENSE_CATEGORIES } from '@/lib/categories';
import { getHouseholdContext } from './auth';

export async function getCategories(
  opts: { includeArchived?: boolean } = {}
): Promise<Category[]> {
  const { supabase, householdId } = await getHouseholdContext();
  let query = supabase.from('categories').select('*').eq('household_id', householdId);
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

// Race-safe seeding of the standard categories. Uses UPSERT with
// ignoreDuplicates so concurrent /budget loads (Next.js prefetch, multiple
// tabs, RSC streaming) can't end up creating duplicate rows. Relies on the
// (household_id, name, kind) unique constraint added in migration 0008.
//
// ignoreDuplicates means: if the row already exists, do nothing - including
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
