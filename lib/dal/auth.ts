// Authentication + household-context bootstrap. Hver DAL-funktion starter
// med getHouseholdContext() for at håndhæve household-scoping i kode (RLS
// dækker også, men dette gør queries simplere - vi behøver ikke tjekke
// permission på hver række).
//
// Wizard/onboarding-paths bruger getMyMembership / isSetupComplete til at
// gate adgang til (app)/-routes før setup_completed_at er sat.

import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveProxyContext } from '@/lib/proxy';
import type { Database } from '@/lib/database.types';

// PERFORMANCE: requireUser kaldes fra alle DAL-funktioner. Cache
// dedupliker auth.getUser() og createClient() per request - de er
// fra-cookie reads (billige), men add up når 10+ DAL-funktioner
// kører i parallel.
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
});

// PERFORMANCE: React's cache() dedupliker kald inden for samme
// request. Dashboard-page kalder getHouseholdContext() indirekte
// 10-15 gange (én gang i hver DAL-funktion); uden dedup koster det
// 10-15 DB-roundtrips alene for auth-context. Med cache: 1 query.
//
// cache() er per-request - to forskellige users får hver deres
// resultat. Cache nulstilles når Next.js streamer responsen ud.
export const getHouseholdContext = cache(async () => {
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
});

// Den indloggede brugers auth-id (Mikkel). Bruges fx af /konti til at
// klassificere konti som Privat (created_by === mig) vs Fælles vs Andet
// (partnerens private). I proxy-mode union: returnerer stadig authUserId
// så Mikkels egne konti vises som "Mine" og Louises som "Andet" - /konti
// renderer alle tre tracks når proxy er aktiv så han ser hele billedet.
export async function getCurrentUserId(): Promise<string> {
  const p = await getPerspective();
  return p.authUserId;
}

// ---------------------------------------------------------------------------
// Perspektiv: hvis bruger har aktivt proxy-toggle (kigger som anden bruger),
// returneres admin-klient + grantorens user_id. Ellers normal user-klient.
//
// HVORFOR ADMIN-CLIENT: Når Mikkel toggler "kig som Louise", skal han se
// HENDES private konti og transaktioner. RLS på user-clienten ville filtrere
// dem væk fordi auth.uid() = Mikkel. Vi bypasser RLS bevidst og GENINDFØRER
// privacy-filteret manuelt i DAL-funktionerne ved at filtrere på
// (editable_by_all OR created_by = perspectiveUserId).
//
// SIKKERHEDSREGLEN: enhver query der bruger perspective.supabase MÅ filtrere
// på householdId. Uden den læses tværs af husstande. Helperen `privateAccountFilter`
// returnerer Postgrest-OR-strengen til den private-aware del.
//
// Hvorfor ikke RLS-løsning med has_active_proxy() direkte i policy: så ville
// Mikkel se Louises private konti HVER GANG grant'en findes, ikke kun når
// han aktivt har valgt at agere som hende. Cookie-toggle giver kontrolleret
// perspektiv-skift; RLS kan ikke læse cookies.
// ---------------------------------------------------------------------------

export type Perspective = {
  supabase: SupabaseClient<Database>;
  householdId: string;
  // user_id der bestemmer privacy (created_by = denne). I normal-mode caller.id,
  // i proxy-mode grantor.id.
  perspectiveUserId: string;
  // Den faktisk indloggede brugers id (caller). Bruges i audit-log som
  // acting_user_id under proxy.
  authUserId: string;
  isProxyActive: boolean;
  grantorName: string | null;
  grantId: string | null;
};

export const getPerspective = cache(async (): Promise<Perspective> => {
  const base = await getHouseholdContext();
  const proxy = await getActiveProxyContext();

  if (!proxy) {
    return {
      supabase: base.supabase,
      householdId: base.householdId,
      perspectiveUserId: base.user.id,
      authUserId: base.user.id,
      isProxyActive: false,
      grantorName: null,
      grantId: null,
    };
  }

  return {
    supabase: createAdminClient(),
    householdId: base.householdId,
    perspectiveUserId: proxy.grantorUserId,
    authUserId: base.user.id,
    isProxyActive: true,
    grantorName: proxy.grantorName,
    grantId: proxy.grantId,
  };
});

// PostgREST `.or()`-streng der mimicker accounts-RLS i proxy-mode.
// V1.6: UNION-mode - Mikkel ser BÅDE Louises private OG sine egne private
// OG fælles konti, så han kan sætte transfers op mellem dem og bevare
// overblikket. Konto-cards har owner_name-badge så det er tydeligt hvis
// er hvis. Dropdowns grupperes via owner_name (se _components/
// AccountSelectGrouped). UI'en viser ejerskab eksplicit i stedet for at
// skjule hans/hendes konti for hinanden.
//
// I normal-mode er udtrykket ikke nødvendigt - RLS håndterer det.
export function privateAccountFilter(p: Perspective): string {
  if (p.isProxyActive && p.authUserId !== p.perspectiveUserId) {
    return `editable_by_all.eq.true,created_by.eq.${p.perspectiveUserId},created_by.eq.${p.authUserId}`;
  }
  return `editable_by_all.eq.true,created_by.eq.${p.perspectiveUserId}`;
}

// Hent id'erne på de konti den nuværende perspective kan se. Bruges af
// queries på child-tabeller (transactions, transfers, components) til at
// mimicke RLS's `can_write_account()`-gating. Cached per request.
export const getVisibleAccountIds = cache(async (): Promise<string[]> => {
  const p = await getPerspective();
  let q = p.supabase
    .from('accounts')
    .select('id')
    .eq('household_id', p.householdId);
  if (p.isProxyActive) q = q.or(privateAccountFilter(p));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
});

// Wizard / onboarding helpers - used by the (app) layout to gate access and
// by the wizard pages to read user-specific state.

// PERFORMANCE: Samme dedup-pattern som getHouseholdContext - kaldes
// flere steder under samme request (proxy, layout, role-check i
// actions) og bør kun ramme DB én gang.
export const getMyMembership = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('family_members')
    .select('household_id, role, setup_completed_at, joined_at, tours_completed')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return { supabase, user, membership: data };
});

export async function isSetupComplete(): Promise<boolean> {
  const { membership } = await getMyMembership();
  return membership?.setup_completed_at != null;
}

// Guard til wizard-actions: hvis brugeren er færdig med setup,
// redirect til dashboard. Forhindrer at man kan kalde wizard-actions
// (med side-effekter på household state) post-setup via direkte POST.
// Undlad at kalde fra completeSetup-action selv (den ER overgangen).
export async function guardWizardOpen() {
  if (await isSetupComplete()) {
    redirect('/dashboard');
  }
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
  'raadgiver',
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
