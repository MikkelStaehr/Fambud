'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import type { HouseholdEconomyType } from '@/lib/database.types';

// Sætter familie-økonomi-modellen og - hvis 'shared' - opdaterer den
// eksisterende lønkonto til at være Fælles. Indkomst fra trin 1 forbliver
// uændret; det er bare kontoen der nu er pooled. Partner's wizard
// detekterer 'shared' og springer lønkonto-oprettelse over til fordel
// for kun-indkomst-registrering på den fælles konto.
//
// Hvis brugeren skifter mellem 'separate' og 'shared' frem og tilbage i
// samme wizard-session, opdaterer vi lønkontoens owner_name tilsvarende
// - det matcher den valgte model når brugeren går videre til næste trin.
export async function setEconomyType(formData: FormData) {
  const typeRaw = String(formData.get('economy_type') ?? '');
  if (typeRaw !== 'separate' && typeRaw !== 'shared') {
    redirect('/wizard/familie?error=' + encodeURIComponent('Ugyldigt valg'));
  }
  const economy_type = typeRaw as HouseholdEconomyType;

  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // 1) Opdater husstandens økonomi-type
  const { error: hhErr } = await supabase
    .from('households')
    .update({ economy_type })
    .eq('id', householdId);
  if (hhErr) {
    redirect('/wizard/familie?error=' + encodeURIComponent(hhErr.message));
  }

  // 2) Justér ejer's eksisterende lønkonto til at matche modellen.
  //    'shared' → owner_name='Fælles', editable_by_all=true, navn omdøbes
  //    til "Fælles Lønkonto" hvis det stadig er default-navnet "Lønkonto".
  //    'separate' → owner_name=null (privat), editable_by_all=false, og
  //    navn omdøbes tilbage hvis det blev "Fælles Lønkonto".
  const { data: ownerLonkonto } = await supabase
    .from('accounts')
    .select('id, name, owner_name')
    .eq('household_id', householdId)
    .eq('created_by', user.id)
    .eq('kind', 'checking')
    .eq('archived', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownerLonkonto) {
    const updates: {
      owner_name: string | null;
      editable_by_all: boolean;
      name?: string;
    } =
      economy_type === 'shared'
        ? {
            owner_name: 'Fælles',
            editable_by_all: true,
            name:
              ownerLonkonto.name === 'Lønkonto'
                ? 'Fælles Lønkonto'
                : ownerLonkonto.name,
          }
        : {
            owner_name: null,
            editable_by_all: false,
            name:
              ownerLonkonto.name === 'Fælles Lønkonto'
                ? 'Lønkonto'
                : ownerLonkonto.name,
          };
    await supabase.from('accounts').update(updates).eq('id', ownerLonkonto.id);
  }

  revalidatePath('/wizard');
  // Fortsæt på samme side; brugeren kan nu se de tre kort med nyt valg
  // og fortsætte til "Næste".
  if (economy_type === 'shared') {
    redirect('/wizard/familie?type=shared');
  } else {
    redirect('/wizard/familie?type=family');
  }
}

// Tilføj partner: family_member-række med email men ingen user_id endnu.
// Når partneren senere bruger invitations-koden vil /join koble user_id +
// joined_at + role='member' på den eksisterende række via email-match.
export async function addPartner(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!name) {
    redirect('/wizard/familie?type=family&error=' + encodeURIComponent('Navn er påkrævet'));
  }
  if (!email || !email.includes('@')) {
    redirect(
      '/wizard/familie?type=family&error=' +
        encodeURIComponent('Ugyldig email')
    );
  }

  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId } = await getHouseholdContext();
  // Pre-godkendt: role bliver 'member' når partneren joiner. For nu
  // sættes user_id + joined_at + role til null. Email er det der gør
  // at /join kan matche partneren til denne række.
  const { error } = await supabase.from('family_members').insert({
    household_id: householdId,
    name,
    email,
    user_id: null,
    role: null,
  });
  if (error) {
    redirect(
      '/wizard/familie?type=family&error=' + encodeURIComponent(error.message)
    );
  }

  revalidatePath('/wizard/familie');
  redirect('/wizard/familie?type=family');
}

// Tilføj barn: family_member uden email og uden user_id. Bruges som
// ejer på børneforbrugskonti og børneopsparing senere i wizarden.
// role=null markerer "dependent" (ingen login).
export async function addChild(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect('/wizard/familie?type=family&error=' + encodeURIComponent('Navn er påkrævet'));
  }

  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase.from('family_members').insert({
    household_id: householdId,
    name,
    email: null,
    user_id: null,
    role: null,
  });
  if (error) {
    redirect(
      '/wizard/familie?type=family&error=' + encodeURIComponent(error.message)
    );
  }

  revalidatePath('/wizard/familie');
  redirect('/wizard/familie?type=family');
}

// Slet pre-godkendt partner eller barn. Vi blokerer mod at fjerne ejeren
// selv (deres family_member-række er knyttet til auth.users og må aldrig
// nukes via wizard).
export async function removeFamilyMember(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // Sikkerhed: forhindrer at ejeren kan fjerne sin egen profil eller
  // andre ACTIVE brugere (deres family_member-række er knyttet til en
  // auth.users-konto - sletning ville låse dem ude permanent fordi
  // signup fejler 'User already registered' og handle_new_user-triggeren
  // ikke fyrer på eksisterende auth.users-rækker).
  const { data: target } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('id', id)
    .eq('household_id', householdId)
    .maybeSingle();
  if (target?.user_id === user.id) {
    redirect(
      '/wizard/familie?type=family&error=' +
        encodeURIComponent('Du kan ikke fjerne dig selv')
    );
  }
  if (target?.user_id != null) {
    redirect(
      '/wizard/familie?type=family&error=' +
        encodeURIComponent(
          'Aktive familiemedlemmer kan ikke fjernes - kontakt support'
        )
    );
  }

  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect(
      '/wizard/familie?type=family&error=' + encodeURIComponent(error.message)
    );
  }

  revalidatePath('/wizard/familie');
  redirect('/wizard/familie?type=family');
}
