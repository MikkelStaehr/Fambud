'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdContext } from '@/lib/dal';

// Marks the user's wizard as complete and sends them into the app proper.
// Goes through the mark_setup_complete() RPC because household_members has
// no UPDATE policy — a direct UPDATE is silently RLS-blocked (no error,
// 0 rows affected) and would leave the user bouncing back to /wizard from
// the (app) layout's setup gate.
export async function completeSetup() {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_setup_complete');
  if (error) throw new Error(error.message);

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

// Generér invitations-kode på det afsluttende done-trin. 7 dages udløb,
// genererbar med ét klik. Knytter sig til household_invites — brugeren
// kopierer link/kode og deler med sin partner uden for appen.
export async function generateInviteFromDone() {
  const { supabase, householdId, user } = await getHouseholdContext();

  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('household_invites').insert({
    household_id: householdId,
    created_by: user.id,
    expires_at,
  });
  if (error) {
    throw new Error(`Could not create invite: ${error.message}`);
  }

  revalidatePath('/wizard/done');
}
