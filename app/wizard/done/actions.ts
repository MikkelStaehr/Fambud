'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
