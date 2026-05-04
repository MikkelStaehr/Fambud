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
    // SECURITY: Internt logger vi den specifikke fejl (trigger-name
    // for nem debug). Til brugeren kaster vi en generisk fejl der
    // ikke afslører backend-topologi.
    console.error(
      'getHouseholdContext: no household for user',
      user.id,
      '- on_auth_user_created trigger may not have fired'
    );
    throw new Error('Internal error');
  }
  return { supabase, householdId: data.household_id, user };
}

// Wizard / onboarding helpers - used by the (app) layout to gate access and
// by the wizard pages to read user-specific state.

export async function getMyMembership() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('family_members')
    .select('household_id, role, setup_completed_at, joined_at, tours_completed')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return { supabase, user, membership: data };
}

export async function isSetupComplete(): Promise<boolean> {
  const { membership } = await getMyMembership();
  return membership?.setup_completed_at != null;
}

// SECURITY: Allowlist over kendte tour-keys. completeTour er en
// 'use server'-action - en authenticated angriber kunne ellers POST'e
// arbitrary keys og bloate sin egen jsonb-kolonne med fx Mb-store
// strenge. Self-inflicted, men trivielt at undgå.
export const KNOWN_TOUR_KEYS = [
  'dashboard',
  'konti',
  'laan',
  'indkomst',
  'budget',
  'poster',
  'overforsler',
  'faste-udgifter',
  'husholdning',
  'opsparinger',
] as const;
type TourKey = (typeof KNOWN_TOUR_KEYS)[number];

function isValidTourKey(key: string): key is TourKey {
  return (KNOWN_TOUR_KEYS as readonly string[]).includes(key);
}

// Per-page tour-state. tours_completed er et jsonb-objekt med
// {tourKey: ISO-timestamp}. hasCompletedTour returnerer true hvis brugeren
// har gennemført den specifikke tour.
export async function hasCompletedTour(tourKey: string): Promise<boolean> {
  const { membership } = await getMyMembership();
  const completed = membership?.tours_completed ?? {};
  return tourKey in completed;
}

// Hjælper til side-komponenter: skal vi auto-starte denne tour? True hvis
// wizard er færdig OG brugeren ikke har set tour'en før. Single helper så
// hver side kan bare kalde `await shouldShowTour('konti')` uden at gentage
// boilerplate.
export async function shouldShowTour(tourKey: string): Promise<boolean> {
  const { membership } = await getMyMembership();
  if (!membership?.setup_completed_at) return false;
  const completed = membership.tours_completed ?? {};
  return !(tourKey in completed);
}

// Markér en tour som gennemført. Læser eksisterende objekt, tilføjer
// timestamp for tourKey, og skriver tilbage. Vi accepterer race-vinduet
// hvor to faner markerer forskellige nøgler samtidig (last-write-wins).
export async function markTourCompleted(tourKey: string) {
  if (!isValidTourKey(tourKey)) {
    // Stille no-op på ukendte keys - vi vil ikke kaste mod en angriber
    // der prøver at probe gyldige keys, men heller ikke skrive garbage.
    return;
  }
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from('family_members')
    .select('tours_completed')
    .eq('user_id', user.id)
    .maybeSingle();
  const raw = existing?.tours_completed;
  const current: Record<string, string> =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, string>)
      : {};
  current[tourKey] = new Date().toISOString();
  const { error } = await supabase
    .from('family_members')
    .update({ tours_completed: current })
    .eq('user_id', user.id);
  if (error) throw error;
}

// Nuller hele tour-state - brugeren ser alle rundture igen næste gang de
// besøger de respektive sider. Bruges af "Genstart rundture"-knap i
// indstillinger.
export async function resetAllTours() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('family_members')
    .update({ tours_completed: {} })
    .eq('user_id', user.id);
  if (error) throw error;
}
