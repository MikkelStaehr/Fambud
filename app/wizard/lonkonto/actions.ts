'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';

export async function createPersonalAccount(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent('Navn er påkrævet'));
  }

  // Owner doesn't see this checkbox in the UI; partner does. Default true.
  const editable_by_all = formData.get('editable_by_all') === 'on';

  // opening_balance intentionally not passed — schema default (0) applies.
  // Cashflow-only model: only ind/ud matters. User can edit it later via
  // /konti/[id] if they ever want to seed a starting balance.
  const { supabase, householdId, user } = await getHouseholdContext();
  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    name,
    owner_name: null,
    kind: 'checking',
    editable_by_all,
    created_by: user.id,
  });
  if (error) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard');
  redirect('/wizard/indkomst');
}
