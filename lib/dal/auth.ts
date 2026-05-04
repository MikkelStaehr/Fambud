// Authentication + household-context bootstrap. Hver DAL-funktion starter
// med getHouseholdContext() for at håndhæve household-scoping i kode (RLS
// dækker også, men dette gør queries simplere - vi behøver ikke tjekke
// permission på hver række).
//
// Wizard/onboarding-paths bruger getMyMembership / isSetupComplete til at
// gate adgang til (app)/-routes før setup_completed_at er sat.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
    throw new Error(
      'No household found for user. The on_auth_user_created trigger may not have fired.'
    );
  }
  return { supabase, householdId: data.household_id, user };
}

// Wizard / onboarding helpers - used by the (app) layout to gate access and
// by the wizard pages to read user-specific state.

export async function getMyMembership() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('family_members')
    .select('household_id, role, setup_completed_at, joined_at, tour_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return { supabase, user, membership: data };
}

export async function isSetupComplete(): Promise<boolean> {
  const { membership } = await getMyMembership();
  return membership?.setup_completed_at != null;
}

// Brugeren afsluttede (eller sprang over) dashboard-touren. Vi sætter
// timestamp så auto-start-logikken ved næste besøg ved at vi har vist
// turen. /indstillinger har en "Genstart rundtur"-knap der nuller det
// tilbage til null.
export async function markTourCompleted() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('family_members')
    .update({ tour_completed_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) throw error;
}

// Resetter tour-flag'et - brugeren vil se rundturen igen.
export async function resetTour() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('family_members')
    .update({ tour_completed_at: null })
    .eq('user_id', user.id);
  if (error) throw error;
}
