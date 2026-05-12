// Family members + household-settings - alle (auth-brugere, pre-godkendte
// med email, og børn uden begge) er rækker i `family_members`. Migration
// 0015 unifierede tidligere `household_members`-tabellen ind i denne, så
// `is_household_member()` (RLS-grundsten) læser direkte herfra.

import type { Household, HouseholdInvite } from '@/lib/database.types';
import { getHouseholdContext } from './auth';

export type SettingsInvite = Pick<
  HouseholdInvite,
  'id' | 'code' | 'created_at' | 'expires_at'
>;

export type FamilyMemberRow = {
  id: string;
  name: string;
  birthdate: string | null;
  user_id: string | null;
  position: number;
  email: string | null;
  role: string | null;
  joined_at: string | null;
  primary_income_source: 'salary' | 'benefits' | null;
  home_address: string | null;
  home_zip_code: string | null;
  home_city: string | null;
  workplace_address: string | null;
  workplace_zip_code: string | null;
  workplace_city: string | null;
  monthly_summary_email_enabled: boolean;
};

export type SettingsData = {
  household: Pick<Household, 'id' | 'name' | 'created_at'>;
  invites: SettingsInvite[];
  familyMembers: FamilyMemberRow[];
  currentUserId: string;
};

export async function getSettingsData(): Promise<SettingsData> {
  const { supabase, householdId, user } = await getHouseholdContext();

  const [householdRes, invitesRes, familyRes] = await Promise.all([
    supabase
      .from('households')
      .select('id, name, created_at')
      .eq('id', householdId)
      .single(),
    supabase
      .from('household_invites')
      .select('id, code, created_at, expires_at')
      .eq('household_id', householdId)
      .is('used_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('family_members')
      .select(
        'id, name, birthdate, user_id, position, email, role, joined_at, primary_income_source, home_address, home_zip_code, home_city, workplace_address, workplace_zip_code, workplace_city, monthly_summary_email_enabled'
      )
      .eq('household_id', householdId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (householdRes.error) throw householdRes.error;
  if (invitesRes.error) throw invitesRes.error;
  if (familyRes.error) throw familyRes.error;

  return {
    household: householdRes.data,
    invites: invitesRes.data ?? [],
    familyMembers: familyRes.data ?? [],
    currentUserId: user.id,
  };
}

export async function getFamilyMembers(): Promise<FamilyMemberRow[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('family_members')
    .select(
      'id, name, birthdate, user_id, position, email, role, joined_at, primary_income_source, home_address, home_zip_code, home_city, workplace_address, workplace_zip_code, workplace_city, monthly_summary_email_enabled'
    )
    .eq('household_id', householdId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Læser husstandens economy_type. Bruges af wizard-forgreningen for at
// vide om vi er i særskilt- eller fælles-økonomi-mode. Default 'separate'
// for husstande oprettet før migration 0035.
export async function getHouseholdEconomyType(): Promise<
  'separate' | 'shared'
> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('households')
    .select('economy_type')
    .eq('id', householdId)
    .maybeSingle();
  if (error) throw error;
  return data?.economy_type ?? 'separate';
}

// Onboarding-status pr. voksent familiemedlem. Bruges af dashboardets
// "Familie-status"-sektion til at vise om de andre i husstanden også
// har sat deres del op - lønkonto, indkomst, overførsler. Den indloggede
// bruger har sin egen OnboardingChecklist længere oppe så vi ekskluderer
// dem fra listen.
export type MemberOnboardingStatus = {
  id: string;
  name: string;
  hasLogin: boolean;            // user_id sat = har signet up
  hasOwnCheckingAccount: boolean; // har oprettet kind='checking' selv
  paycheckCount: number;        // antal primary 'once' paychecks
  hasRecurringTransfersOut: boolean; // mindst én recurring transfer fra deres konti
};

export async function getOtherMembersOnboardingStatus(): Promise<
  MemberOnboardingStatus[]
> {
  const { supabase, householdId, user } = await getHouseholdContext();

  const { data: members } = await supabase
    .from('family_members')
    .select('id, name, user_id, email')
    .eq('household_id', householdId)
    .neq('user_id', user.id);
  // Kun voksne (har email eller er logget ind) - børn ekskluderes.
  const adults = (members ?? []).filter(
    (m) => m.user_id != null || m.email != null
  );
  if (adults.length === 0) return [];

  // Hent alle relevante data i parallel og match efter user_id i memory.
  const userIds = adults.map((m) => m.user_id).filter((u): u is string => !!u);

  const [accountsRes, paychecksRes, transfersRes] = await Promise.all([
    userIds.length > 0
      ? supabase
          .from('accounts')
          .select('id, kind, created_by, archived')
          .eq('household_id', householdId)
          .in('created_by', userIds)
          .eq('archived', false)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('transactions')
      .select('family_member_id')
      .eq('household_id', householdId)
      .eq('income_role', 'primary')
      .eq('recurrence', 'once'),
    userIds.length > 0
      ? supabase
          .from('transfers')
          .select('from_account_id, accounts!from_account_id(created_by)')
          .eq('household_id', householdId)
          .neq('recurrence', 'once')
      : Promise.resolve({ data: [], error: null }),
  ]);

  type AccountRow = { id: string; kind: string; created_by: string | null };
  const accounts = (accountsRes.data as AccountRow[] | null) ?? [];
  const checkingByUser = new Set(
    accounts.filter((a) => a.kind === 'checking').map((a) => a.created_by!)
  );

  const paychecksByMember = new Map<string, number>();
  for (const p of paychecksRes.data ?? []) {
    if (!p.family_member_id) continue;
    paychecksByMember.set(
      p.family_member_id,
      (paychecksByMember.get(p.family_member_id) ?? 0) + 1
    );
  }

  type TransferJoin = { accounts: { created_by: string | null } | null };
  const transfers = (transfersRes.data as TransferJoin[] | null) ?? [];
  const transfersByCreator = new Set(
    transfers
      .map((t) => t.accounts?.created_by)
      .filter((u): u is string => !!u)
  );

  return adults.map((m) => ({
    id: m.id,
    name: m.name,
    hasLogin: m.user_id != null,
    hasOwnCheckingAccount: m.user_id ? checkingByUser.has(m.user_id) : false,
    paycheckCount: paychecksByMember.get(m.id) ?? 0,
    hasRecurringTransfersOut: m.user_id ? transfersByCreator.has(m.user_id) : false,
  }));
}

// Fornavn på den indloggede bruger - bruges til at personliggøre headings
// ("Godmorgen, Mikkel"). Returnerer null hvis brugeren ikke har navn sat.
export async function getCurrentMemberFirstName(): Promise<string | null> {
  const { supabase, user } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('family_members')
    .select('name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.name) return null;
  // Fornavn = første ord. "Mikkel Stæhr" → "Mikkel".
  return data.name.split(/\s+/)[0] ?? null;
}
