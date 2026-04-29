// Family members + household-settings — alle (auth-brugere, pre-godkendte
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
        'id, name, birthdate, user_id, position, email, role, joined_at, primary_income_source'
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
      'id, name, birthdate, user_id, position, email, role, joined_at, primary_income_source'
    )
    .eq('household_id', householdId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Fornavn på den indloggede bruger — bruges til at personliggøre headings
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
