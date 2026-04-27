'use server';

import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';

// Wizard-specific invite generator: 7-day expiry, no UI for tweaking it. The
// regular createInvite in indstillinger/actions reads expires_in_days from
// the form — we don't want to bother the wizard user with that choice.
export async function generateWizardInvite() {
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

  revalidatePath('/wizard/invite');
}
