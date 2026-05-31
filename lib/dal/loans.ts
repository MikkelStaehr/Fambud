// Loans - credit accounts with the loan-metadata fields populated.
// /laan surfaces every kind='credit' account regardless of whether the
// loan-specific fields (loan_type, original_principal, term_months, lender,
// payment_amount) are set, since the wizard creates them empty and the
// /laan edit form is where the user fills them in.

import type { Account } from '@/lib/database.types';
import { getPerspective, privateAccountFilter } from './auth';

export type LoanRow = Account;

export async function getLoans(): Promise<LoanRow[]> {
  const p = await getPerspective();
  let q = p.supabase
    .from('accounts')
    .select('*')
    .eq('household_id', p.householdId)
    .eq('kind', 'credit')
    .eq('archived', false);
  q = q.or(privateAccountFilter(p));
  const { data, error } = await q.order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getLoanById(id: string): Promise<LoanRow> {
  const p = await getPerspective();
  let q = p.supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('household_id', p.householdId)
    .eq('kind', 'credit');
  q = q.or(privateAccountFilter(p));
  const { data, error } = await q.single();
  if (error) throw error;
  return data;
}
