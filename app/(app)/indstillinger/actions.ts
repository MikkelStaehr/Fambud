'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext, getMyMembership, resetAllTours } from '@/lib/dal';
import type { CategoryKind } from '@/lib/database.types';

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

  const name = String(formData.get('name') ?? '').trim();
  const homeAddress = String(formData.get('home_address') ?? '').trim();
  const homeZipCode = String(formData.get('home_zip_code') ?? '').trim();
  const homeCity = String(formData.get('home_city') ?? '').trim();
  const workplaceAddress = String(formData.get('workplace_address') ?? '').trim();
  const workplaceZipCode = String(formData.get('workplace_zip_code') ?? '').trim();
  const workplaceCity = String(formData.get('workplace_city') ?? '').trim();

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
    redirect('/indstillinger?error=' + encodeURIComponent(error.message));
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
    throw new Error(`Could not create invite: ${error.message}`);
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

  if (error) throw new Error(`Could not delete invite: ${error.message}`);

  revalidatePath('/indstillinger');
}

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------
const VALID_KINDS: readonly CategoryKind[] = ['income', 'expense'];

function readCategoryForm(formData: FormData):
  | { error: string }
  | { data: { name: string; kind: CategoryKind; color: string } } {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Navn er påkrævet' };

  const kindRaw = String(formData.get('kind') ?? '');
  if (!VALID_KINDS.includes(kindRaw as CategoryKind)) {
    return { error: 'Ugyldig kategoritype' };
  }

  // Hex colour: '#' + 3 or 6 hex digits. Falls back to a neutral grey.
  let color = String(formData.get('color') ?? '').trim();
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
    redirect('/indstillinger?error=' + encodeURIComponent(error.message));
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
    redirect(
      `/indstillinger/kategorier/${encodeURIComponent(id)}?error=` +
        encodeURIComponent(error.message)
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  revalidatePath('/indstillinger');
}

// ----------------------------------------------------------------------------
// Family members
// ----------------------------------------------------------------------------
// Lightweight email validation - Postgres citext + the global unique index
// handle the canonical checks. We just guard against obvious typos here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createFamilyMember(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect('/indstillinger?error=' + encodeURIComponent('Navn er påkrævet'));
  }

  const birthdateRaw = String(formData.get('birthdate') ?? '').trim();
  const birthdate = birthdateRaw && /^\d{4}-\d{2}-\d{2}$/.test(birthdateRaw)
    ? birthdateRaw
    : null;

  const emailRaw = String(formData.get('email') ?? '').trim().toLowerCase();
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
    // Friendlier copy for the unique-email collision (handle_new_user uses
    // this index to claim signups, so duplicates are a real risk).
    const msg = error.message.includes('family_members_email_unique')
      ? 'Den email er allerede brugt på et familiemedlem'
      : error.message;
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
  if (error) throw new Error(error.message);

  revalidatePath('/indstillinger');
  revalidatePath('/faste-udgifter', 'layout');
  revalidatePath('/budget');
}
