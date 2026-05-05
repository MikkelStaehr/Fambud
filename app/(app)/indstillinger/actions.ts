'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext, getMyMembership, resetAllTours } from '@/lib/dal';
import type { CategoryKind } from '@/lib/database.types';
import { capLength, TEXT_LIMITS } from '@/lib/format';

// Genstart dashboard-touren - sætter tour_completed_at tilbage til null
// så turen auto-starter ved næste dashboard-besøg. Bruges af "Genstart
// rundtur"-knappen i Min profil-sektionen.
export async function restartTour() {
  await resetAllTours();
  redirect('/dashboard');
}

// Opdaterer den indloggede brugers egen family_member-række. Felter der
// ikke er udfyldt sættes til null så brugeren kan rydde dem aktivt.
export async function updateMyProfile(formData: FormData) {
  const { supabase, user } = await getHouseholdContext();

  const name = capLength(String(formData.get('name') ?? '').trim(), TEXT_LIMITS.shortName);
  const homeAddress = capLength(String(formData.get('home_address') ?? '').trim(), TEXT_LIMITS.mediumName);
  const homeZipCode = capLength(String(formData.get('home_zip_code') ?? '').trim(), 20);
  const homeCity = capLength(String(formData.get('home_city') ?? '').trim(), TEXT_LIMITS.shortName);
  const workplaceAddress = capLength(String(formData.get('workplace_address') ?? '').trim(), TEXT_LIMITS.mediumName);
  const workplaceZipCode = capLength(String(formData.get('workplace_zip_code') ?? '').trim(), 20);
  const workplaceCity = capLength(String(formData.get('workplace_city') ?? '').trim(), TEXT_LIMITS.shortName);

  const { error } = await supabase
    .from('family_members')
    .update({
      name: name || 'Bruger', // navn er NOT NULL - fald tilbage til placeholder
      home_address: homeAddress || null,
      home_zip_code: homeZipCode || null,
      home_city: homeCity || null,
      workplace_address: workplaceAddress || null,
      workplace_zip_code: workplaceZipCode || null,
      workplace_city: workplaceCity || null,
    })
    .eq('user_id', user.id);

  if (error) {
    // SECURITY: Læk ikke raw DB-fejl ind i URL'en (kan indeholde
    // schema-/constraint-navne der hjælper en angriber).
    console.error('updateMyProfile failed:', error.message);
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent('Profilen kunne ikke gemmes. Prøv igen.')
    );
  }

  revalidatePath('/indstillinger');
  revalidatePath('/dashboard');
}

// Empty / 0 / non-numeric → no expiry. Any positive integer → that many days.
function parseExpiresInDays(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export async function createInvite(formData: FormData) {
  const { supabase, householdId, user } = await getHouseholdContext();

  const days = parseExpiresInDays(formData.get('expires_in_days'));
  const expires_at =
    days === null
      ? null
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  // `code` has a SQL default of generate_invite_code() - we don't pass it.
  const { error } = await supabase.from('household_invites').insert({
    household_id: householdId,
    created_by: user.id,
    expires_at,
  });

  if (error) {
    // Surface the message in dev; in real life this is essentially never hit.
    { console.error('Could not create invite:', error.message); throw new Error('Could not create invite'); }
  }

  revalidatePath('/indstillinger');
}

export async function deleteInvite(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('household_invites')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) { console.error('Could not delete invite:', error.message); throw new Error('Could not delete invite'); }

  revalidatePath('/indstillinger');
}

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------
const VALID_KINDS: readonly CategoryKind[] = ['income', 'expense'];

function readCategoryForm(formData: FormData):
  | { error: string }
  | { data: { name: string; kind: CategoryKind; color: string } } {
  const name = capLength(String(formData.get('name') ?? '').trim(), TEXT_LIMITS.shortName);
  if (!name) return { error: 'Navn er påkrævet' };

  const kindRaw = String(formData.get('kind') ?? '');
  if (!VALID_KINDS.includes(kindRaw as CategoryKind)) {
    return { error: 'Ugyldig kategoritype' };
  }

  // Hex colour: '#' + 3 or 6 hex digits. Falls back to a neutral grey.
  let color = capLength(String(formData.get('color') ?? '').trim(), 20);
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color)) {
    color = '#94a3b8';
  }

  return { data: { name, kind: kindRaw as CategoryKind, color } };
}

export async function createCategory(formData: FormData) {
  const parsed = readCategoryForm(formData);
  if ('error' in parsed) {
    redirect('/indstillinger?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase.from('categories').insert({
    household_id: householdId,
    ...parsed.data,
  });
  if (error) {
    redirect('/indstillinger?error=' + encodeURIComponent('Operationen fejlede - prøv igen'));
  }

  revalidatePath('/indstillinger');
}

export async function updateCategory(id: string, formData: FormData) {
  const parsed = readCategoryForm(formData);
  if ('error' in parsed) {
    redirect(
      `/indstillinger/kategorier/${encodeURIComponent(id)}?error=` +
        encodeURIComponent(parsed.error)
    );
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('categories')
    .update(parsed.data)
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('updateCategory failed:', error.message);
    redirect(
      `/indstillinger/kategorier/${encodeURIComponent(id)}?error=` +
        encodeURIComponent('Kategorien kunne ikke gemmes')
    );
  }

  revalidatePath('/indstillinger');
  redirect('/indstillinger');
}

// Soft-delete: transactions reference categories ON DELETE SET NULL, so a hard
// delete would orphan them. Archiving keeps the link intact for history.
export async function archiveCategory(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('categories')
    .update({ archived: true })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }
  revalidatePath('/indstillinger');
}

export async function restoreCategory(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('categories')
    .update({ archived: false })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }
  revalidatePath('/indstillinger');
}

// ----------------------------------------------------------------------------
// Family members
// ----------------------------------------------------------------------------
// Lightweight email validation - Postgres citext + the global unique index
// handle the canonical checks. We just guard against obvious typos here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createFamilyMember(formData: FormData) {
  // SECURITY: Kun owner må tilføje familiemedlemmer. Tidligere kunne
  // ethvert husstand-medlem oprette rækker - kombineret med Path 2 i
  // handle_new_user (nu fjernet, migration 0043) gav det en
  // account-hijacking-vej. Selv uden Path 2 er begrænsningen
  // fornuftig, så ikke-ejere ikke roder familielisten.
  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent('Kun ejeren kan tilføje familiemedlemmer')
    );
  }

  const name = capLength(String(formData.get('name') ?? '').trim(), TEXT_LIMITS.shortName);
  if (!name) {
    redirect('/indstillinger?error=' + encodeURIComponent('Navn er påkrævet'));
  }

  const birthdateRaw = String(formData.get('birthdate') ?? '').trim();
  const birthdate = birthdateRaw && /^\d{4}-\d{2}-\d{2}$/.test(birthdateRaw)
    ? birthdateRaw
    : null;

  const emailRaw = capLength(String(formData.get('email') ?? '').trim().toLowerCase(), TEXT_LIMITS.mediumName);
  let email: string | null = null;
  if (emailRaw) {
    if (!EMAIL_RE.test(emailRaw)) {
      redirect('/indstillinger?error=' + encodeURIComponent('Ugyldig email'));
    }
    email = emailRaw;
  }

  const { supabase, householdId } = await getHouseholdContext();

  // Append to the end. Same pattern as transaction_components - sequence-based
  // ordering, no gaps to manage.
  const { data: last } = await supabase
    .from('family_members')
    .select('position')
    .eq('household_id', householdId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (last?.position ?? -1) + 1;

  const { error } = await supabase.from('family_members').insert({
    household_id: householdId,
    name,
    birthdate,
    email,
    position: nextPos,
  });
  if (error) {
    // Per-household unique-index på (household_id, email) - ramler
    // hvis samme email allerede ER tilknyttet et medlem i denne
    // husstand. Tidligere var indekset globalt for at understøtte
    // Path 2 i handle_new_user, men det er fjernet (migration 0043).
    // SECURITY: Andre constraint-violations må IKKE lække raw - de
    // ville afsløre schema-/trigger-/kolonne-navne i URL'en.
    console.error('createFamilyMember failed:', error.message);
    const msg = error.message.includes('family_members_email')
      ? 'Den email er allerede brugt på et familiemedlem i jeres husstand'
      : 'Familiemedlemmet kunne ikke oprettes - prøv igen';
    redirect('/indstillinger?error=' + encodeURIComponent(msg));
  }

  revalidatePath('/indstillinger');
  // Faste-udgifter og budget-overblik bruger family list i dropdowns/visning.
  revalidatePath('/faste-udgifter', 'layout');
  revalidatePath('/budget');
}

export async function deleteFamilyMember(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  // SECURITY: Kun owner må slette family_members. Uden denne tjek kunne
  // et almindeligt medlem POST'e en forged request og slette ejerens
  // egen family_member-række - det ville låse ejeren ude permanent
  // (auth.users-rækken består, så signup fejler "User already
  // registered", og handle_new_user-triggeren fyrer ikke igen).
  // RLS tillader sletningen pga. "members manage family"-policy'en
  // - så role-tjekket SKAL ske her i action'en.
  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent('Kun ejeren kan fjerne familiemedlemmer')
    );
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // Læs target-rækken først for at afvise to specifikke scenarier:
  // 1. owner forsøger at slette sin egen profil (lockout)
  // 2. target har user_id sat (er en aktiv bruger) - sletning ville
  //    låse den person ude. Kun pre-godkendte / ikke-claimet rækker
  //    (user_id IS NULL) eller børn må slettes via denne flow.
  const { data: target } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('id', id)
    .eq('household_id', householdId)
    .maybeSingle();
  if (!target) {
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent('Familiemedlemmet findes ikke')
    );
  }
  if (target.user_id === user.id) {
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent('Du kan ikke fjerne dig selv')
    );
  }
  if (target.user_id != null) {
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent(
          'Aktive familiemedlemmer kan ikke fjernes herfra - kontakt support'
        )
    );
  }

  // ON DELETE SET NULL on the FK columns means existing transactions and
  // components keep working - they just lose their tag.
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }

  revalidatePath('/indstillinger');
  revalidatePath('/faste-udgifter', 'layout');
  revalidatePath('/budget');
}
