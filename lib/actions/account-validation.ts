// SECURITY: Validér at account_id fra FormData henviser til en konto
// af den FORVENTEDE type i samme husstand. RLS via can_write_account
// blokerer cross-household, men ikke at en bruger laver fx en
// "transaction" på en kreditkonto/lån (RLS lader det igennem fordi
// kontoen er i deres egen husstand). Det vil pollute lån-balance og
// cashflow-graf med fake afdrag.
//
// Brug:
//   const acc = await assertAccountKind(supabase, householdId, accountId, ['checking', 'savings', 'household']);
//   if (!acc.ok) return { error: acc.error };

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountKind, Database } from '@/lib/database.types';

type Client = SupabaseClient<Database>;

export type AssertAccountResult =
  | { ok: true; kind: AccountKind }
  | { ok: false; error: string };

export async function assertAccountKind(
  supabase: Client,
  householdId: string,
  accountId: string,
  allowedKinds: readonly AccountKind[]
): Promise<AssertAccountResult> {
  if (!accountId) return { ok: false, error: 'Vælg en konto' };
  const { data, error } = await supabase
    .from('accounts')
    .select('kind, archived')
    .eq('id', accountId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: 'Kontoen findes ikke' };
  }
  if (data.archived) {
    return { ok: false, error: 'Kontoen er arkiveret' };
  }
  if (!allowedKinds.includes(data.kind)) {
    return { ok: false, error: 'Operationen er ikke tilladt på denne kontotype' };
  }
  return { ok: true, kind: data.kind };
}

// Standard whitelists pr. domæne
export const POSTER_KINDS: AccountKind[] = [
  'checking',
  'savings',
  'household',
  'budget',
  'cash',
  'other',
];
export const TRANSFER_KINDS: AccountKind[] = [
  'checking',
  'savings',
  'household',
  'budget',
  'investment',
  'cash',
  'other',
  'credit', // transfers TO/FROM credit konto er tilladt (afdrag)
];
export const HOUSEHOLD_PURCHASE_KINDS: AccountKind[] = ['household'];
export const FIXED_EXPENSE_KINDS: AccountKind[] = ['budget', 'checking'];
